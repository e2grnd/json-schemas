// Validation tests for corrsolutions-da-circuit-manifest.schema.json
import Ajv from "ajv/dist/2020"
import addFormats from "ajv-formats"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

import schema from "../../v0/corrsolutions-da-circuit-manifest.schema.json" with { type: "json" }

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)

describe("CorrSolutions DA Circuit Manifest Schema", () => {
  it("should validate passing fixture", () => {
    const data = JSON.parse(
      readFileSync(
        join(__dirname, "../../data/v0/passing_corrsolutions_da_circuit_manifest_v0.json"),
        "utf8",
      ),
    )
    expect(validate(data)).toBe(true)
  })

  it("should fail validation for failing fixture", () => {
    const data = JSON.parse(
      readFileSync(
        join(__dirname, "../../data/v0/failing_corrsolutions_da_circuit_manifest_v0.json"),
        "utf8",
      ),
    )
    expect(validate(data)).toBe(false)
    expect(validate.errors).toBeDefined()
  })
})
