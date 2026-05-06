# JSON Schemas

JSON Schema definitions for E2G APIs, published to GitHub Pages at
`https://e2grnd.github.io/json-schemas/`.

## Repository layout

```
json-schemas/
├── v0/                        # Hand-authored general-purpose schemas (draft 2020-12)
├── webhooks/
│   └── v0/                    # Webhook event envelope + per-event-type schemas (draft-07)
├── plantmanager/
│   └── v0/                    # PlantManager / hub-api DTO schemas (draft-07, generated)
│       └── enums/             # Pure-enum schemas written by the generator
├── data/
│   └── v0/                    # Fixture JSON files used by tests (passing & failing cases)
├── tests/
│   ├── v0/                    # Vitest tests for v0 schemas
│   └── webhooks/v0/           # Vitest tests for webhook schemas
└── tools/
    └── gen-plantmanager-schemas.ts   # Code-gen script for plantmanager/v0
```

## Schema categories

### `v0/` — General-purpose schemas

Hand-authored schemas used across multiple E2G products.

| File | Description |
|---|---|
| `corrsolutions-da-circuit-manifest.schema.json` | Manifest for CorrSolutions DA Circuit data uploads (Degradation Analysis calculator) |
| `dashboard.asset.schema.json` | Asset Analysis Dashboard layout and widget state |
| `input.probabilistic.schema.json` | Input for probabilistic calculation runs |
| `input.timeseries.schema.json` | Input for time-series calculation runs |
| `iow.threshold.schema.json` | Integrity Operating Window threshold definition |

### `webhooks/v0/` — Webhook event schemas

Schemas for the webhook event system. Every delivery is wrapped in a common
envelope (`envelope.schema.json`); the `data` field is discriminated by
`eventType`.

| Event type | File |
|---|---|
| `calculation.eec.{created,started,completed,failed}` | `calculation.eec.*.schema.json` |
| `calculation.sage.{created,started,completed,failed}` | `calculation.sage.*.schema.json` |
| `plantmanager.equipment.{created,updated,deleted}` | `plantmanager.equipment.*.schema.json` |
| `subscription.disabled` | `subscription.disabled.schema.json` |
| `webhook.test` | `webhook.test.schema.json` |

The envelope enforces a `<domain>.<resource-type>.<verb>` naming convention for
`eventType` and carries a semver `schemaVersion` field so consumers can select
the correct data schema for validation.

### `plantmanager/v0/` — PlantManager / hub-api DTO schemas

Over 200 JSON Schema draft-07 files covering every DTO exposed by the
PlantManager `hub-api` service.  **These files are generated — do not edit them
by hand.**  See [Regenerating PlantManager schemas](#regenerating-plantmanager-schemas) below.

Integer-valued enums from the OpenAPI spec are converted to string enums. Each
converted enum schema includes an `x-enum-map` extension
(`{ "StringName": intValue }`) so consumers can round-trip back to the integer
values required by the API.

An `enum-registry.json` file is written alongside the schemas containing a
consolidated map of every enum type in the spec.

## Development

### Prerequisites

- Node.js (version managed via `.npmrc` / Yarn)
- Install dependencies:

```sh
npm install
```

### Running tests

```sh
npm test
```

Tests use [Vitest](https://vitest.dev/) and validate both passing and failing
fixture documents in `data/` against their corresponding schemas using
[AJV](https://ajv.js.org/).

Watch mode:

```sh
npm run test:watch
```

## Regenerating PlantManager schemas

The files under `plantmanager/v0/` are generated from the `hub-api` OpenAPI 3.0
spec.  Run the generator whenever the hub-api spec changes:

```sh
npm run generate-schemas
```

This fetches the live spec from the default dev endpoint
(`https://scus-pm-hub-api-dev-appsvc.azurewebsites.net/swagger/v1/swagger.json`),
converts every object schema to JSON Schema draft-07, and writes the results to
`plantmanager/v0/`.

### Generator options

```
Usage: gen-plantmanager-schemas [options]

Options:
  --url <url>         URL of the OpenAPI spec to download
                      (default: dev hub-api swagger endpoint)
  --schema <name>     Generate only this named schema (default: all object schemas)
  --out-dir <path>    Output directory (default: plantmanager/v0)
  --id-base <url>     Base URL for $id fields
                      (default: https://e2grnd.github.io/json-schemas/plantmanager/v0)
  --dry-run           Print generated JSON to stdout instead of writing files
  --no-dereference    Skip $ref resolution; enum schemas are written separately
                      under <out-dir>/enums/
```

**Default behaviour (with `$ref` dereferencing):** enum values are inlined into
each DTO schema, producing fully self-contained files with no external
references.

**`--no-dereference`:** `$ref` pointers are rewritten to relative file URIs
(e.g. `./enums/asset-types.schema.json`) and standalone enum schema files are
generated under `plantmanager/v0/enums/`. Use this when you want to keep the
enum definitions in one place and reference them from multiple DTO schemas.

### Examples

Regenerate from a local or staging spec:

```sh
npm run generate-schemas -- --url https://your-staging-host/swagger/v1/swagger.json
```

Preview a single schema without writing any files:

```sh
npm run generate-schemas -- --schema EquipmentDto --dry-run
```

Generate with external enum references instead of inlining:

```sh
npm run generate-schemas -- --no-dereference
```
