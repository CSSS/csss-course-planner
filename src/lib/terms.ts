import type { AcademicTerm, Semester, SfuValue } from "../types/sfu-api.ts";

const SEMESTER_ORDER: Readonly<Record<Semester, number>> = {
  spring: 0,
  summer: 1,
  fall: 2,
};

export function isSemester(value: string): value is Semester {
  return value === "spring" || value === "summer" || value === "fall";
}

export function formatTerm(term: AcademicTerm): string {
  return `${term.year}/${term.semester}`;
}

export function parseStartTerm(value: string): AcademicTerm {
  const match = /^(?<year>\d{4})\/(?<semester>spring|summer|fall)$/.exec(value);

  if (!match?.groups) {
    throw new Error(
      `Invalid start term "${value}". Expected YYYY/spring, YYYY/summer, or YYYY/fall.`,
    );
  }

  return {
    year: Number(match.groups.year),
    semester: match.groups.semester as Semester,
  };
}

export function getCurrentAcademicTerm(date: Date): AcademicTerm {
  const month = date.getMonth();
  let semester: Semester;

  if (month <= 3) {
    semester = "spring";
  } else if (month <= 7) {
    semester = "summer";
  } else {
    semester = "fall";
  }

  return {
    year: date.getFullYear(),
    semester,
  };
}

export function compareTerms(left: AcademicTerm, right: AcademicTerm): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return SEMESTER_ORDER[left.semester] - SEMESTER_ORDER[right.semester];
}

export function buildTermHistory(
  availableYears: readonly SfuValue[],
  availableTermsByYear: ReadonlyMap<number, readonly SfuValue[]>,
  startTerm: AcademicTerm,
): AcademicTerm[] {
  const history: AcademicTerm[] = [];

  for (const yearEntry of availableYears) {
    const year = Number(yearEntry.value);

    if (!Number.isInteger(year)) {
      continue;
    }

    for (const termEntry of availableTermsByYear.get(year) ?? []) {
      const semester = termEntry.value.toLowerCase();

      if (!isSemester(semester)) {
        continue;
      }

      const term = { year, semester };

      if (compareTerms(term, startTerm) <= 0) {
        history.push(term);
      }
    }
  }

  const uniqueTerms = new Map<string, AcademicTerm>();

  for (const term of history) {
    uniqueTerms.set(formatTerm(term), term);
  }

  return [...uniqueTerms.values()].sort((left, right) =>
    compareTerms(right, left),
  );
}
