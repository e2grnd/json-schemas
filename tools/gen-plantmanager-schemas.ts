#!/usr/bin/env node
/**
 * gen-plantmanager-schemas.ts
 *
 * Downloads the hub-api OpenAPI 3.0 spec and generates JSON Schema draft-07
 * files for each object schema in components/schemas.
 *
 * Usage:
 *   tsx tools/gen-plantmanager-schemas.ts [options]
 *
 * See --help for all options.
 */

import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { program } from "commander";

const require = createRequire(import.meta.url);

// CJS libraries loaded via require (they do not ship ESM exports)
const $RefParser = require("@apidevtools/json-schema-ref-parser");
const { openapiSchemaToJsonSchema } = require(
  "@openapi-contrib/openapi-schema-to-json-schema",
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OasSchema {
  type?: string | string[];
  properties?: Record<string, OasSchema>;
  enum?: unknown[];
  description?: string;
  format?: string;
  nullable?: boolean;
  items?: OasSchema;
  allOf?: OasSchema[];
  anyOf?: OasSchema[];
  oneOf?: OasSchema[];
  $ref?: string;
  [key: string]: unknown;
}

interface OasSpec {
  components?: {
    schemas?: Record<string, OasSchema>;
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

program
  .name("gen-plantmanager-schemas")
  .description(
    "Generate JSON Schema draft-07 files from the hub-api OpenAPI 3.0 spec",
  )
  .option(
    "--url <url>",
    "URL of the OpenAPI spec to download",
    "https://scus-pm-hub-api-dev-appsvc.azurewebsites.net/swagger/v1/swagger.json",
  )
  .option(
    "--schema <name>",
    "Generate only this named schema (default: all object schemas)",
  )
  .option("--out-dir <path>", "Output directory", "plantmanager/v0")
  .option(
    "--id-base <url>",
    "Base URL for $id fields",
    "https://e2grnd.github.io/json-schemas/plantmanager/v0",
  )
  .option("--dry-run", "Print generated JSON to stdout instead of writing files")
  .option(
    "--no-dereference",
    "Skip $ref resolution; enum schemas are written separately under <out-dir>/enums/",
  )
  .parse();

const opts = program.opts<{
  url: string;
  schema?: string;
  outDir: string;
  idBase: string;
  dryRun?: boolean;
  dereference: boolean; // commander sets this to false when --no-dereference is passed
}>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert PascalCase / camelCase schema names to kebab-case.
 * Consecutive uppercase runs (e.g. "RBI") are treated as a single word.
 *
 * Examples:
 *   EquipmentDto       → equipment-dto
 *   ApiServiceClasses  → api-service-classes
 *   RBIAnalysisDto     → rbi-analysis-dto
 */
function toKebab(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Pattern for the OAS enum description format: "1 = Name, 2 = OtherName, ..."
 * Values can be multi-word (e.g. "1 = Some Value") but in practice are
 * single PascalCase identifiers.
 */
const ENUM_DESC_RE = /(\d+)\s*=\s*([^,]+?)(?=\s*(?:,\s*\d|$))/g;

/**
 * Parse an OAS enum description string into a number→string map.
 * Returns null if the description doesn't match the expected format.
 */
function parseEnumDescription(
  description: string,
): Map<number, string> | null {
  const map = new Map<number, string>();
  let matched = false;
  for (const m of description.matchAll(ENUM_DESC_RE)) {
    map.set(parseInt(m[1], 10), m[2].trim());
    matched = true;
  }
  return matched ? map : null;
}

/**
 * Check whether a schema node is an integer enum that can be string-converted.
 * Handles both plain `type: "integer"` and nullable `type: ["integer", "null"]`
 * (the latter produced by the OAS→JSON Schema converter from `nullable: true`).
 */
function isIntegerEnum(node: OasSchema): boolean {
  if (!Array.isArray(node.enum)) return false;
  const t = node.type;
  if (t === "integer") return true;
  if (Array.isArray(t) && t.includes("integer")) return true;
  return false;
}

/**
 * Recursively walk every node in the schema tree and apply post-processing:
 *
 * 1. Remove min/max injected by the OAS→JSON Schema library for numeric formats.
 * 2. Remove pattern injected for byte format.
 * 3. Convert integer enums with description mappings to string enums and attach
 *    an `x-enum-map` extension ({ "StringName": intValue, ... }) so consumers
 *    can round-trip back to the integer values required by the API.
 */
function postProcess(node: unknown): void {
  if (node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach(postProcess);
    return;
  }

  const obj = node as OasSchema;

  // --- 1 & 2. Strip library-injected keywords from numeric/byte formats ----
  if (
    typeof obj.format === "string" &&
    ["int32", "int64", "float", "double"].includes(obj.format)
  ) {
    delete obj.minimum;
    delete obj.maximum;
  }
  if (obj.format === "byte") {
    delete obj.pattern;
  }

  // --- 3. Integer enum → string enum conversion + x-enum-map attachment ----
  if (isIntegerEnum(obj) && typeof obj.description === "string") {
    const mapping = parseEnumDescription(obj.description);
    if (mapping !== null && Array.isArray(obj.enum)) {
      // Build ordered string enum from the integer values
      const stringEnum = (obj.enum as number[]).map(
        (v) => mapping.get(v) ?? String(v),
      );

      // Build the string→int reverse map for x-enum-map
      const enumMap: Record<string, number> = {};
      for (const [intVal, strName] of mapping.entries()) {
        enumMap[strName] = intVal;
      }

      // Preserve nullability: ["integer","null"] → ["string","null"]
      const wasNullable =
        Array.isArray(obj.type) && (obj.type as string[]).includes("null");

      obj.enum = stringEnum;
      obj.type = wasNullable ? ["string", "null"] : "string";
      obj["x-enum-map"] = enumMap;
      delete obj.format;
      delete obj.description;
    }
  }

  // --- Recurse into all child values ---------------------------------------
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === "object") {
      postProcess(val);
    }
  }
}

/**
 * Recursively rewrite OAS `$ref` paths of the form `#/components/schemas/X`
 * to relative file URIs, used when --no-dereference is set.
 *
 * - Pure enum schemas (no `properties`) live under ./enums/<kebab-name>.schema.json
 * - Object schemas (have `properties`) live as siblings ./<kebab-name>.schema.json
 *
 * Note: in JSON Schema draft-07, `$ref` ignores all sibling keywords, so we
 * never add `x-enum-map` to a property node that is a `$ref` — the map lives
 * on the enum schema file itself instead.
 */
function rewriteRefs(
  node: unknown,
  allSchemas: Record<string, OasSchema>,
): void {
  if (node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((n) => rewriteRefs(n, allSchemas));
    return;
  }

  const obj = node as Record<string, unknown>;

  if (typeof obj["$ref"] === "string") {
    const match = (obj["$ref"] as string).match(/^#\/components\/schemas\/(.+)$/);
    if (match) {
      const schemaName = match[1];
      const target = allSchemas[schemaName];
      if (target) {
        const kebabName = toKebab(schemaName);
        obj["$ref"] = target.properties
          ? `./${kebabName}.schema.json`
          : `./enums/${kebabName}.schema.json`;
      }
    }
    // Don't recurse into a $ref node — siblings are ignored by draft-07
    return;
  }

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === "object") {
      rewriteRefs(val, allSchemas);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Download the spec
  console.error(`Fetching spec from ${opts.url} …`);
  const response = await fetch(opts.url);
  if (!response.ok) {
    console.error(`Failed to fetch spec: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  const specRaw: OasSpec = await response.json();

  const allSchemas = specRaw.components?.schemas ?? {};
  const totalCount = Object.keys(allSchemas).length;
  console.error(`Spec loaded — ${totalCount} schemas found`);

  // 2. Build the enum registry from the raw spec's pure-enum schemas.
  //
  // We do this before dereferencing so we have the canonical OAS schema name
  // as the registry key (e.g. "AssetTypes", "ServiceStatus") and there are no
  // circular reference concerns.  Pure-enum schemas never contain $refs.
  //
  // Registry format: { [OasSchemaName]: { [StringValue]: intValue } }
  const enumRegistry: Record<string, Record<string, number>> = {};
  for (const [schemaName, schema] of Object.entries(allSchemas)) {
    if (!schema.properties && Array.isArray(schema.enum) && typeof schema.description === "string") {
      const mapping = parseEnumDescription(schema.description);
      if (mapping !== null) {
        const entry: Record<string, number> = {};
        for (const [intVal, strName] of mapping.entries()) {
          entry[strName] = intVal;
        }
        enumRegistry[schemaName] = entry;
      }
    }
  }
  console.error(`Built enum registry — ${Object.keys(enumRegistry).length} enum types`);

  // 3. Optionally dereference all $refs so enums are inlined into DTO properties.
  //    When --no-dereference is set we skip this and instead rewrite $ref URIs
  //    to point at sibling files, and generate the enum schemas separately.
  let schemas: Record<string, OasSchema>;
  if (opts.dereference) {
    console.error("Dereferencing $refs …");
    const spec: OasSpec = await $RefParser.dereference(specRaw);
    schemas = spec.components?.schemas ?? {};
  } else {
    console.error("Skipping $ref resolution (--no-dereference) …");
    schemas = allSchemas;
  }

  // 4. Determine which schemas to process
  //    - If --schema given: just that one (error if not found / not an object schema)
  //    - Otherwise: all object schemas (those with `properties`), skip pure enums
  let targets: Array<[string, OasSchema]>;

  if (opts.schema) {
    const found = schemas[opts.schema];
    if (!found) {
      console.error(
        `Schema "${opts.schema}" not found. Available schemas:\n` +
          Object.keys(schemas).sort().join(", "),
      );
      process.exit(1);
    }
    if (!found.properties) {
      console.error(
        `Schema "${opts.schema}" is a pure enum schema (no properties). ` +
          `Only object schemas are written as files; enum values are ${opts.dereference ? "inlined into DTO schemas" : "generated under <out-dir>/enums/"}.`,
      );
      process.exit(1);
    }
    targets = [[opts.schema, found]];
  } else {
    targets = Object.entries(schemas).filter(
      ([, s]) => s.properties !== undefined,
    );
    console.error(
      `Processing ${targets.length} object schemas ` +
        `(skipping ${totalCount - targets.length} pure enum / non-object schemas)`,
    );
  }

  // 5. Process each schema
  const outDir = resolve(opts.outDir);
  if (!opts.dryRun) {
    mkdirSync(outDir, { recursive: true });
  }

  let written = 0;

  for (const [name, oasSchema] of targets) {
    // 5a. Convert OAS 3.0 → JSON Schema draft-07
    //
    // When dereferencing, the schema graph may contain circular or shared
    // references that cause lodash's deep-clone (used internally by
    // openapiSchemaToJsonSchema when cloneSchema:true) to blow the call stack,
    // and cause JSON.stringify to throw on genuine cycles.
    //
    // We break the cycles with a custom JSON replacer that silently drops any
    // object we've already serialised.  This is safe because a circular schema
    // would produce infinite recursion in any validator anyway.
    const freshSchema: OasSchema = JSON.parse(
      JSON.stringify(oasSchema, (() => {
        const seen = new WeakSet();
        return (_key: string, value: unknown) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return undefined;
            seen.add(value);
          }
          return value;
        };
      })()),
    );
    const converted: OasSchema = openapiSchemaToJsonSchema(freshSchema, {
      cloneSchema: false,
      strictMode: false,
    });

    // 5b. When not dereferencing, rewrite OAS $ref paths to relative file URIs
    //     before post-processing (post-processing won't touch $ref nodes).
    if (!opts.dereference) {
      rewriteRefs(converted, allSchemas);
    }

    // 5c. Post-process (strip injected keywords, convert integer enums).
    //     In no-dereference mode enum properties are still $refs so the
    //     integer-enum conversion is a no-op here; it runs when the enum
    //     schemas themselves are generated below.
    postProcess(converted);

    // 5c. Assemble the output schema
    const kebabName = toKebab(name);
    const idUrl = `${opts.idBase.replace(/\/$/, "")}/${kebabName}.schema.json`;

    const output: Record<string, unknown> = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: idUrl,
      title: name,
    };

    // Include description only if the OAS schema has one at the root
    if (typeof converted.description === "string" && converted.description) {
      output.description = converted.description;
    }

    output.type = converted.type ?? "object";
    output.additionalProperties = false;

    if (converted.properties) {
      output.properties = converted.properties;
    }

    // Carry over required array if present
    if (Array.isArray(converted.required) && converted.required.length > 0) {
      output.required = converted.required;
    }

    // 5d. Emit
    const json = JSON.stringify(output, null, 2) + "\n";

    if (opts.dryRun) {
      process.stdout.write(`// --- ${name} (${kebabName}.schema.json) ---\n`);
      process.stdout.write(json);
      process.stdout.write("\n");
    } else {
      const outPath = join(outDir, `${kebabName}.schema.json`);
      writeFileSync(outPath, json, "utf-8");
      written++;
    }
  }

  // 6. When not dereferencing, generate enum schemas under <outDir>/enums/
  //
  //    Each file is a standalone JSON Schema draft-07 document for a pure-enum
  //    OAS schema, with the integer values converted to strings and an
  //    `x-enum-map` extension for round-tripping back to the integer API values.
  //    The $id base for these files is <idBase>/enums/<kebab-name>.schema.json.
  if (!opts.dereference) {
    const enumsDir = join(outDir, "enums");
    const idBase = opts.idBase.replace(/\/$/, "");
    let enumsWritten = 0;

    const enumEntries = Object.entries(allSchemas).filter(
      ([, s]) => !s.properties && Array.isArray(s.enum),
    );

    if (opts.dryRun) {
      process.stdout.write(`// === enum schemas (${enumEntries.length} total) ===\n\n`);
    } else {
      mkdirSync(enumsDir, { recursive: true });
    }

    for (const [enumName, enumSchema] of enumEntries) {
      const mapping =
        typeof enumSchema.description === "string"
          ? parseEnumDescription(enumSchema.description)
          : null;

      if (!mapping) continue; // skip any enum without a parseable description

      const stringEnum = (enumSchema.enum as number[]).map(
        (v) => mapping.get(v) ?? String(v),
      );
      const enumMap: Record<string, number> = {};
      for (const [intVal, strName] of mapping.entries()) {
        enumMap[strName] = intVal;
      }

      const kebabName = toKebab(enumName);
      const output: Record<string, unknown> = {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: `${idBase}/enums/${kebabName}.schema.json`,
        title: enumName,
        type: "string",
        enum: stringEnum,
        "x-enum-map": enumMap,
      };

      const json = JSON.stringify(output, null, 2) + "\n";

      if (opts.dryRun) {
        process.stdout.write(`// --- ${enumName} (enums/${kebabName}.schema.json) ---\n`);
        process.stdout.write(json);
        process.stdout.write("\n");
      } else {
        writeFileSync(join(enumsDir, `${kebabName}.schema.json`), json, "utf-8");
        enumsWritten++;
      }
    }

    if (!opts.dryRun) {
      console.error(`Wrote ${enumsWritten} enum schema file(s) to ${enumsDir}`);
    }
  }

  // 8. Write (or print) the enum registry
  //
  // Sorted by key for stable diffs.  Written regardless of whether --schema
  // was used, since the registry covers all enums in the spec.
  const registryJson =
    JSON.stringify(
      Object.fromEntries(
        Object.entries(enumRegistry).sort(([a], [b]) => a.localeCompare(b)),
      ),
      null,
      2,
    ) + "\n";

  if (opts.dryRun) {
    process.stdout.write("// --- enum-registry.json ---\n");
    process.stdout.write(registryJson);
  } else {
    const registryPath = join(outDir, "enum-registry.json");
    writeFileSync(registryPath, registryJson, "utf-8");
    console.error(`Wrote enum registry → ${registryPath}`);
    console.error(`Done — wrote ${written} schema file(s) to ${outDir}`);
  }
}

main().catch((err: unknown) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
