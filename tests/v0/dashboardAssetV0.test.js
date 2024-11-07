const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020').default;
const ajv = new Ajv({ strict: false, allErrors: true});

const dashboardAssetSchema = require('../../v0/dashboard.asset.schema.json');
const validate_dashboard_asset = ajv.compile(dashboardAssetSchema);


describe('Asset Dashboard data validation', () => {
  it('validates passing data against the schema', () => {
    const passingData = require('../../data/v0/passing_dashboard_asset_v0.json');
    const isValid = validate_dashboard_asset(passingData);
    expect(validate_dashboard_asset.errors).toBeNull();
    expect(isValid).toBeTruthy(); // Assert that the data passes validation
  });

  it('validates failing data against the schema', () => {
    const failingData = require('../../data/v0/failing_dashboard_asset_v0.json');
    const isValid = validate_dashboard_asset(failingData);
    expect(validate_dashboard_asset.errors).toMatchSnapshot(); // Assert that the data fails validation
  });
})
