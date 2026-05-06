import Ajv from "ajv/dist/2020"
import probabilisticSchema from "../../v0/input.probabilistic.schema.json" with { type: "json" }
import passingData from "../../data/v0/passing_probabilistic_v0.json" with { type: "json" }
import passingData2 from "../../data/v0/passing_probabilistic2_v0.json" with { type: "json" }
import failingData from "../../data/v0/failing_probabilistic_v0.json" with { type: "json" }

const ajv = new Ajv({ strict: false, allErrors: true })
const validate_probabilistic = ajv.compile(probabilisticSchema)

describe("Probabilistic data validation", () => {
  it("validates passing data against the schema", () => {
    const isValid = validate_probabilistic(passingData)
    expect(validate_probabilistic.errors).toBeNull()
    expect(isValid).toBeTruthy()
  })

  it("validates a different case of passing data against the schema", () => {
    const isValid = validate_probabilistic(passingData2)
    expect(validate_probabilistic.errors).toBeNull()
    expect(isValid).toBeTruthy()
  })

  it("validates failing data against the schema", () => {
    const isValid = validate_probabilistic(failingData)
    expect(validate_probabilistic.errors).toMatchSnapshot()
    expect(isValid).toBeFalsy()
  })
})
