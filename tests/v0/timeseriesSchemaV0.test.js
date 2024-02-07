const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020').default;
const ajv = new Ajv({ strict: false, allErrors: true});

const timeseriesSchema = require('../../v0/input.timeseries.schema.json');
ajv.getSchema("https://json-schema.org/draft/2020-12/schema")
const validate_timeseries = ajv.compile(timeseriesSchema);


describe('Timeseries data validation', () => {
  it('validates passing data against the schema', () => {
    const passingData = require('../../data/v0/passing_timeseries_v0.json');
    const isValid = validate_timeseries(passingData);
    expect(validate_timeseries.errors).toBeNull();
    expect(isValid).toBeTruthy(); // Assert that the data passes validation
  });

  it('validates failing data against the schema', () => {
    const failingData = require('../../data/v0/failing_timeseries_v0.json');
    const isValid = validate_timeseries(failingData);
    expect(validate_timeseries.errors).toMatchSnapshot(); // Assert that the data fails validation
  });
})