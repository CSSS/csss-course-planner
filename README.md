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

## Course classes

`SfuCourses` fetches SFU outlines, parses prerequisites and corequisites, and
caches course details and lecture sections in SQLite. `DatabaseObject` handles
cached reads and transactional saves internally.

```ts
import { SfuCourses } from "./src/index.ts";

const courses = new SfuCourses("./course-planner.db");
try {
  const latest = await courses.getCourseInfo("CMPT 307");
  console.dir(latest, { depth: null });

  const fall = await courses.getCourseInfo("CMPT 307", {
    year: 2026,
    semester: "fall",
  });
} finally {
  courses.close();
}
```

## Tests

Run `npm test` to run the parser tests and check TypeScript types.

There are some tests written in [test.ts](./src/test.ts).
They don't check all courses, just the ones that have differing patterns.

