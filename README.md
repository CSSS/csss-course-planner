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

## Database setup

Copy `.env.example` to `.env` and set `DATABASE_PATH` to your database file path.
Relative paths are resolved from the project directory when running the command;
the parent directory must already exist.

```sh
npm run db:push
```

This creates or updates the database tables using `src/db/tables.ts` and
`drizzle.config.ts`.

`openDatabase(path)` only opens the connection and enables foreign keys. It does
not create tables or load `.env`; callers supply their configured path. Set up
the tables with `db:push` before querying them.

## Tests

There are some tests written in [test.ts](./src/test.ts).
They don't check all courses, just the ones that have differing patterns.

