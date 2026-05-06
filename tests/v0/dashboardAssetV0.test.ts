import Ajv from "ajv/dist/2020"
import dashboardAssetSchema from "../../v0/dashboard.asset.schema.json" with { type: "json" }
import passingData from "../../data/v0/passing_dashboard_asset_v0.json" with { type: "json" }
import failingData from "../../data/v0/failing_dashboard_asset_v0.json" with { type: "json" }

const ajv = new Ajv({ strict: false, allErrors: true })
const validate_dashboard_asset = ajv.compile(dashboardAssetSchema)

describe("Asset Dashboard data validation", () => {
  it("validates passing data against the schema", () => {
    const isValid = validate_dashboard_asset(passingData)
    expect(validate_dashboard_asset.errors).toBeNull()
    expect(isValid).toBeTruthy()
  })

  it("validates failing data against the schema", () => {
    const isValid = validate_dashboard_asset(failingData)
    expect(validate_dashboard_asset.errors).toMatchSnapshot()
    expect(isValid).toBeFalsy()
  })
})
