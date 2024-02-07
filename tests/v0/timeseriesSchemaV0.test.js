// Assuming the structure you provided and the path to the schema file
const timeseriesSchema = require('../../v0/timeseries_schema.json');

describe('Timeseries data validation', () => {
  it('validates passing data against the schema', () => {
    const passingData = require('../../data/v0/passing_timeseries_v0.json');
    expect(passingData).toMatchSchema(timeseriesSchema);
  });

  it('validates failing data against the schema', () => {
    const failingData = require('../../data/v0/failing_timeseries_v0.json');
    // Use .not for expecting the validation to fail
    expect(failingData).not.toMatchSchema(timeseriesSchema);
  });
});
