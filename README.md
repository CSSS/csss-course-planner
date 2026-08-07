# CSSS SFU Course Dependencies

Project to parse and create graphs of courses.

## Requirements

- Node v26

## Usage

- Ensure you have `prerequisites-XXX.json` in the root directory.
- The file to read from is currently hard-coded.
- To run use
```sh
npm run start
```

## Tests

There are some tests written in [test.ts](./src/test.ts).
They don't check all courses, just the ones that have differing patterns.

