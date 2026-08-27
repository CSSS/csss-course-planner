# CSSS SFU Course Dependencies

Project to parse and create graphs of courses.

## Requirements

- Node v26

## Usage

1. Get the prerequisites by getting the degree requirements:

```bash
node ./src/fetch-course-outlines.ts --input degree-requirements.json
```

2. Run the parser to parse the prerequisites:

- Ensure you have `prerequisites-XXX.json` in the root directory.
- The file to read from is currently hard-coded, so you may want to change it to accept CLI args
```sh
npm run start > output.txt
```

## Tests

There are some tests written in [test.ts](./src/test.ts).
They don't check all courses, just the ones that have differing patterns.

