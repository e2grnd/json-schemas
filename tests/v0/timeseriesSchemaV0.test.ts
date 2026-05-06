import Ajv from "ajv/dist/2020"
import timeseriesSchema from "../../v0/input.timeseries.schema.json" with { type: "json" }
import passingData from "../../data/v0/passing_timeseries_v0.json" with { type: "json" }
import failingData from "../../data/v0/failing_timeseries_v0.json" with { type: "json" }

const ajv = new Ajv({ strict: false, allErrors: true })
const validate_timeseries = ajv.compile(timeseriesSchema)

describe("Timeseries data validation", () => {
  it("validates passing data against the schema", () => {
    const isValid = validate_timeseries(passingData)
    expect(validate_timeseries.errors).toBeNull()
    expect(isValid).toBeTruthy()
  })

  it("validates failing data against the schema", () => {
    const isValid = validate_timeseries(failingData)
    expect(validate_timeseries.errors).toMatchSnapshot()
    expect(isValid).toBeFalsy()
  })
})
