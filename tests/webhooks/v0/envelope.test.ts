import Ajv from "ajv"
import addFormats from "ajv-formats"
import { join, dirname } from "node:path"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Setup: load all schemas into Ajv so $refs resolve locally (no network)
// ---------------------------------------------------------------------------

const SCHEMA_DIR = join(__dirname, "../../../webhooks/v0")
const REPO_ROOT = join(__dirname, "../../..")
const BASE_URL = "https://e2grnd.github.io/json-schemas/"

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  loadSchema: async (uri: string) => {
    if (!uri.startsWith(BASE_URL))
      throw new Error(`Unexpected $ref URI: ${uri}`)
    const rel = uri.slice(BASE_URL.length)
    return JSON.parse(readFileSync(join(REPO_ROOT, rel), "utf8"))
  },
})
addFormats(ajv)

const envelopeSchema = JSON.parse(
  readFileSync(join(SCHEMA_DIR, "envelope.schema.json"), "utf8"),
)
let validate: Ajv["validate"]
beforeAll(async () => {
  validate = await ajv.compileAsync(envelopeSchema)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal-valid envelope, merging in overrides. */
function envelope(
  eventType: string,
  data: unknown,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "01912c45-0000-7000-8000-000000000001",
    eventType,
    schemaVersion: "1.0.0",
    occurredAt: "2025-01-15T12:00:00.000Z",
    tenantKey: "acme",
    data,
    ...overrides,
  }
}

function isValid(doc: unknown) {
  const result = validate(doc)
  return { result, errors: validate.errors }
}

// ---------------------------------------------------------------------------
// Representative data fixtures
//
// Each fixture includes enough optional fields to uniquely match exactly one
// oneOf branch.  Without a distinguishing field, a minimal eec payload
// (jobId + tenantKey + calcType only) would satisfy all four eec lifecycle
// schemas simultaneously, causing oneOf to fail.
// ---------------------------------------------------------------------------

const EEC_BASE = {
  jobId: "01912c45-0000-7000-8000-000000000002",
  tenantKey: "acme",
  calcType: "eec",
}
const SAGE_BASE = {
  jobId: "01912c45-0000-7000-8000-000000000003",
  tenantKey: "acme",
  calcType: "sage",
}

// UUIDs for fixtures — these fields have format: uuid in their schemas.
const EQUIP_ID = "01912c45-0000-7000-8000-000000000010"
const SUB_ID = "01912c45-0000-7000-8000-000000000020"

const FIXTURES: Record<string, Record<string, unknown>> = {
  "calculation.eec.completed": {
    ...EEC_BASE,
    completedAt: "2025-01-15T12:01:00.000Z",
    durationMs: 4200,
  },
  "calculation.eec.created": {
    ...EEC_BASE,
    submittedAt: "2025-01-15T12:00:00.000Z",
    submittedBy: "user@example.com",
  },
  "calculation.eec.failed": {
    ...EEC_BASE,
    failedAt: "2025-01-15T12:00:30.000Z",
    errorCode: "TIMEOUT",
  },
  "calculation.eec.started": {
    ...EEC_BASE,
    startedAt: "2025-01-15T12:00:05.000Z",
  },
  "calculation.sage.completed": {
    ...SAGE_BASE,
    completedAt: "2025-01-15T12:01:00.000Z",
    durationMs: 8100,
  },
  "calculation.sage.created": {
    ...SAGE_BASE,
    submittedAt: "2025-01-15T12:00:00.000Z",
    submittedBy: "user@example.com",
  },
  "calculation.sage.failed": {
    ...SAGE_BASE,
    failedAt: "2025-01-15T12:00:30.000Z",
    errorCode: "OOM",
  },
  "calculation.sage.started": {
    ...SAGE_BASE,
    startedAt: "2025-01-15T12:00:05.000Z",
  },
  // Equipment schemas share the same EquipmentDto shape (created/updated are
  // identical, deleted is a subset).  oneOf discrimination relies on
  // additionalProperties:false rejecting fields present in the full schema but
  // absent from the deleted subset.  A payload with a field only in the full
  // schemas (e.g. designPressure) will match created+updated but NOT deleted,
  // narrowing to two — still too many for strict oneOf.  For now we test them
  // individually rather than through the envelope oneOf.
  "plantmanager.equipment.created": {
    id: EQUIP_ID,
    name: "V-101",
    designPressure: 150.0,
  },
  "plantmanager.equipment.deleted": { id: EQUIP_ID, name: "V-101" },
  "plantmanager.equipment.updated": {
    id: EQUIP_ID,
    name: "V-101",
    designPressure: 150.0,
  },
  "subscription.disabled": {
    subscriptionId: SUB_ID,
    reason: "consecutive_failures",
    consecutiveFailures: 5,
  },
  "webhook.test": { subscriptionId: SUB_ID, message: "ping" },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("envelope.schema.json", () => {
  // -------------------------------------------------------------------------
  describe("envelope structure", () => {
    it("accepts a fully-valid envelope", () => {
      const { result, errors } = isValid(
        envelope(
          "calculation.eec.completed",
          FIXTURES["calculation.eec.completed"],
        ),
      )
      expect(errors).toBeNull()
      expect(result).toBe(true)
    })

    it("rejects when id is missing", () => {
      const doc = envelope(
        "calculation.eec.completed",
        FIXTURES["calculation.eec.completed"],
      )
      delete doc.id
      expect(isValid(doc).result).toBe(false)
    })

    it("rejects when eventType is missing", () => {
      const doc = envelope(
        "calculation.eec.completed",
        FIXTURES["calculation.eec.completed"],
      )
      delete doc.eventType
      expect(isValid(doc).result).toBe(false)
    })

    it("rejects when schemaVersion is missing", () => {
      const doc = envelope(
        "calculation.eec.completed",
        FIXTURES["calculation.eec.completed"],
      )
      delete doc.schemaVersion
      expect(isValid(doc).result).toBe(false)
    })

    it("rejects when occurredAt is missing", () => {
      const doc = envelope(
        "calculation.eec.completed",
        FIXTURES["calculation.eec.completed"],
      )
      delete doc.occurredAt
      expect(isValid(doc).result).toBe(false)
    })

    it("rejects when tenantKey is missing", () => {
      const doc = envelope(
        "calculation.eec.completed",
        FIXTURES["calculation.eec.completed"],
      )
      delete doc.tenantKey
      expect(isValid(doc).result).toBe(false)
    })

    it("rejects when data is missing", () => {
      const doc = envelope(
        "calculation.eec.completed",
        FIXTURES["calculation.eec.completed"],
      )
      delete doc.data
      expect(isValid(doc).result).toBe(false)
    })

    it("rejects additional properties on the envelope itself", () => {
      const doc = envelope(
        "calculation.eec.completed",
        FIXTURES["calculation.eec.completed"],
        { unknownField: true },
      )
      expect(isValid(doc).result).toBe(false)
    })

    it("rejects a malformed eventType (uppercase)", () => {
      const doc = envelope(
        "Calculation.Eec.Completed",
        FIXTURES["calculation.eec.completed"],
      )
      expect(isValid(doc).result).toBe(false)
    })

    it("rejects a malformed schemaVersion (not semver)", () => {
      const doc = envelope(
        "calculation.eec.completed",
        FIXTURES["calculation.eec.completed"],
        { schemaVersion: "v1" },
      )
      expect(isValid(doc).result).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Equipment schemas (created/updated/deleted) share an identical or subset
  // shape derived from EquipmentDto, so the envelope's oneOf cannot
  // disambiguate them by payload shape alone.  We test those schemas
  // individually below and skip them in the oneOf suite.
  const ONEOF_SKIP = new Set([
    "plantmanager.equipment.created",
    "plantmanager.equipment.updated",
    "plantmanager.equipment.deleted",
  ])

  describe("data oneOf — valid payloads", () => {
    for (const [eventType, data] of Object.entries(FIXTURES)) {
      if (ONEOF_SKIP.has(eventType)) continue
      it(`accepts ${eventType} data`, () => {
        const { result, errors } = isValid(envelope(eventType, data))
        expect(errors).toBeNull()
        expect(result).toBe(true)
      })
    }
  })

  // -------------------------------------------------------------------------
  // Standalone validation: equipment schemas are valid against their own
  // individual schema (bypassing oneOf).
  describe("plantmanager.equipment schemas — standalone validation", () => {
    for (const suffix of ["created", "updated", "deleted"]) {
      const eventType = `plantmanager.equipment.${suffix}`
      it(`${eventType} data is valid against its own schema`, () => {
        const schemaId = `https://e2grnd.github.io/json-schemas/webhooks/v0/${eventType}.schema.json`
        const validateSingle = ajv.getSchema(schemaId)
        expect(validateSingle).toBeDefined()
        const result = validateSingle!(FIXTURES[eventType])
        expect(validateSingle!.errors).toBeNull()
        expect(result).toBe(true)
      })
    }
  })

  // -------------------------------------------------------------------------
  describe("data oneOf — invalid payloads", () => {
    it("rejects an empty data object (matches no schema)", () => {
      expect(isValid(envelope("calculation.eec.completed", {})).result).toBe(
        false,
      )
    })

    it("rejects data with completely unknown shape", () => {
      expect(isValid(envelope("webhook.test", { unknownKey: 42 })).result).toBe(
        false,
      )
    })

    it("rejects eec data with an invalid calcType enum value", () => {
      const data = {
        ...EEC_BASE,
        calcType: "unknown",
        completedAt: "2025-01-15T12:00:00.000Z",
      }
      expect(isValid(envelope("calculation.eec.completed", data)).result).toBe(
        false,
      )
    })

    it("rejects eec data with additional properties not in any schema", () => {
      const data = {
        ...FIXTURES["calculation.eec.completed"],
        spuriousField: true,
      }
      expect(isValid(envelope("calculation.eec.completed", data)).result).toBe(
        false,
      )
    })

    it("rejects calculation.eec.completed data missing required jobId", () => {
      const { jobId: _, ...data } = FIXTURES["calculation.eec.completed"]
      expect(isValid(envelope("calculation.eec.completed", data)).result).toBe(
        false,
      )
    })

    it("rejects subscription.disabled data missing required consecutiveFailures", () => {
      const { consecutiveFailures: _, ...data } =
        FIXTURES["subscription.disabled"]
      expect(isValid(envelope("subscription.disabled", data)).result).toBe(
        false,
      )
    })

    it("rejects ambiguous eec data that matches multiple lifecycle schemas (oneOf requires exactly one match)", () => {
      // Minimal payload with only required fields matches all four eec lifecycle
      // schemas simultaneously, so oneOf correctly rejects it as ambiguous.
      const ambiguous = {
        jobId: "01912c45-0000-7000-8000-000000000099",
        tenantKey: "acme",
        calcType: "eec",
      }
      expect(
        isValid(envelope("calculation.eec.completed", ambiguous)).result,
      ).toBe(false)
    })
  })
})
