// Validation tests for corrsolutions-da-circuit-manifest.schema.json
const Ajv = require('ajv/dist/2020');
const fs = require('fs');
const path = require('path');

const addFormats = require('ajv-formats');
const schema = require('../../v0/corrsolutions-da-circuit-manifest.schema.json');
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

describe('CorrSolutions DA Circuit Manifest Schema', () => {
  it('should validate passing fixture', () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/v0/passing_corrsolutions_da_circuit_manifest_v0.json')));
    expect(validate(data)).toBe(true);
  });

  it('should fail validation for failing fixture', () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/v0/failing_corrsolutions_da_circuit_manifest_v0.json')));
    expect(validate(data)).toBe(false);
    expect(validate.errors).toBeDefined();
  });
});
