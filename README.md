# JSON Schema Guide

This README provides a concise guide on using JSON Schema, focusing on its usage, structure, and versioning. JSON Schema is a powerful tool for validating the structure of JSON data, making it invaluable for developers working with JSON formats.

## Usage

To use JSON Schema for validating JSON data:

1. **Define your schema**: Create a JSON Schema definition that describes the structure of your JSON data. This includes specifying properties, types, and other validation keywords.

2. **Validate JSON data**: Use a JSON Schema validation tool or library to validate JSON data against your schema. This can be done programmatically in various programming languages or using online validators.

## Structure

A basic JSON Schema structure includes:

- `$schema`: The version of the JSON Schema specification being used.
- `type`: The type of data being described (e.g., `object`, `array`, `string`, `number`).
- `properties`: An object that specifies the properties (keys) of the data and their schema definitions.

Example:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" }
  }
}
