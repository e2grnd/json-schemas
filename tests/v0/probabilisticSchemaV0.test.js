const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020').default;
const ajv = new Ajv({ strict: false, allErrors: true});

const probabilisticSchema = require('../../v0/input.probabilistic.schema.json');
const validate_probabilistic = ajv.compile(probabilisticSchema);


describe('Probabilistic data validation', () => {
  it('validates passing data against the schema', () => {
    const passingData = require('../../data/v0/passing_probabilistic_v0.json');
    const isValid = validate_probabilistic(passingData);
    expect(validate_probabilistic.errors).toBeNull();
    expect(isValid).toBeTruthy(); // Assert that the data passes validation
  });

  it('validates failing data against the schema', () => {
    const failingData = require('../../data/v0/failing_probabilistic_v0.json');
    const isValid = validate_probabilistic(failingData);
    expect(validate_probabilistic.errors).toMatchSnapshot(); // Assert that the data fails validation
  });
})
