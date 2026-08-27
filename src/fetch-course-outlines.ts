import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDegreeCourses } from "./lib/course-fetcher.ts";
import {
  createPrerequisitesFile,
  getPrerequisitesFileName,
  serializePrerequisitesFile,
} from "./lib/output.ts";
import { SfuClient, type CourseOutlineSource } from "./lib/sfu-client.ts";
import { discoverTermHistory } from "./lib/term-history.ts";
import { getCurrentAcademicTerm, parseStartTerm } from "./lib/terms.ts";
import type { DegreeRequirementsFile } from "./types/degree-requirements.ts";

export type CliOptions = {
  inputPath: string;
  startTerm?: string;
};

export type CliDependencies = {
  source?: CourseOutlineSource;
  now?: () => Date;
  cwd?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

export type CliResult = {
  outputPath: string;
  missingCourses: string[];
};

export function parseCliArgs(args: readonly string[]): CliOptions {
  let inputPath: string | undefined;
  let startTerm: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (argument === "--input") {
      if (inputPath !== undefined || value === undefined) {
        throw new Error("--input must be provided exactly once with a value.");
      }

      inputPath = value;
      index += 1;
      continue;
    }

    if (argument === "--start-term") {
      if (startTerm !== undefined || value === undefined) {
        throw new Error(
          "--start-term may be provided once and requires a value.",
        );
      }

      parseStartTerm(value);
      startTerm = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument "${argument ?? ""}".`);
  }

  if (inputPath === undefined) {
    throw new Error("--input <degree-requirements-file> is required.");
  }

  return startTerm === undefined
    ? { inputPath }
    : { inputPath, startTerm };
}

export async function runCli(
  args: readonly string[],
  dependencies: CliDependencies = {},
): Promise<CliResult> {
  const options = parseCliArgs(args);
  const now = (dependencies.now ?? (() => new Date()))();
  const cwd = dependencies.cwd ?? process.cwd();
  const stdout = dependencies.stdout ?? console.log;
  const stderr = dependencies.stderr ?? console.error;
  const inputPath = resolve(cwd, options.inputPath);
  const inputStats = await stat(inputPath);

  if (!inputStats.isFile()) {
    throw new Error(`Input path is not a file: ${inputPath}`);
  }

  const input = JSON.parse(
    await readFile(inputPath, "utf8"),
  ) as DegreeRequirementsFile;
  const startTerm =
    options.startTerm === undefined
      ? getCurrentAcademicTerm(now)
      : parseStartTerm(options.startTerm);
  const source = dependencies.source ?? new SfuClient();
  const termHistory = await discoverTermHistory(source, startTerm);

  if (termHistory.length === 0) {
    throw new Error("SFU returned no terms at or before the selected start term.");
  }

  const summary = await fetchDegreeCourses(
    source,
    input.courses,
    termHistory,
  );
  const createdAt = Math.floor(now.getTime() / 1_000);
  const outputFile = createPrerequisitesFile(summary.courses, createdAt);
  const outputPath = resolve(cwd, getPrerequisitesFileName(createdAt));

  await writeFile(outputPath, serializePrerequisitesFile(outputFile), {
    encoding: "utf8",
    flag: "wx",
  });

  stdout(`Wrote ${summary.courses.length} courses to ${outputPath}`);

  if (summary.missingCourses.length > 0) {
    stderr(
      `Courses not found in SFU history: ${summary.missingCourses.join(", ")}`,
    );
  }

  return {
    outputPath,
    missingCourses: summary.missingCourses,
  };
}

const entryPoint = process.argv[1];

if (
  entryPoint !== undefined &&
  fileURLToPath(import.meta.url) === resolve(entryPoint)
) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
