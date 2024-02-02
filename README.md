# JSON Schema

This repository acts as a store for all json schema files used in e2g projects.

## Usage

To use JSON Schema:

1. **Define your schema**: Create a JSON Schema definition that describes the structure of your JSON data. This includes specifying properties, types, and other validation keywords.

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
