import { mapWithConcurrency } from "./concurrency.ts";
import { isHttpNotFound } from "./http-client.ts";
import type { CourseOutlineSource } from "./sfu-client.ts";
import type { DegreeRequirementCourse } from "../types/degree-requirements.ts";
import type {
  CourseLookupResult,
  EnrichedCourse,
} from "../types/prerequisites.ts";
import type { AcademicTerm, SfuSection } from "../types/sfu-api.ts";

export type ParsedCourseCode = {
  department: string;
  courseNumber: string;
};

export type CourseFetchSummary = {
  courses: EnrichedCourse[];
  missingCourses: string[];
};

export function parseCourseCode(course: string): ParsedCourseCode {
  const match =
    /^(?<department>[A-Z]{2,5}) (?<courseNumber>\d{3}[A-Z]?)$/.exec(course);

  if (!match?.groups) {
    throw new Error(`Invalid normalized course code "${course}".`);
  }

  const { department, courseNumber } = match.groups;

  if (department === undefined || courseNumber === undefined) {
    throw new Error(`Invalid normalized course code "${course}".`);
  }

  return {
    department,
    courseNumber,
  };
}

export function rankEnrollmentSections(
  sections: readonly SfuSection[],
): SfuSection[] {
  const enrollmentSections = sections.filter(
    (section) => section.classType === "e",
  );

  return [
    ...enrollmentSections.filter((section) => section.sectionCode === "LEC"),
    ...enrollmentSections.filter((section) => section.sectionCode !== "LEC"),
  ];
}

export async function fetchCourseOutline(
  source: Pick<CourseOutlineSource, "getSections" | "getOutline">,
  requirement: DegreeRequirementCourse,
  termHistory: readonly AcademicTerm[],
): Promise<CourseLookupResult> {
  const { department, courseNumber } = parseCourseCode(requirement.course);

  for (const term of termHistory) {
    let sections: SfuSection[];

    try {
      sections = await source.getSections(term, department, courseNumber);
    } catch (error) {
      if (isHttpNotFound(error)) {
        continue;
      }

      throw error;
    }

    for (const section of rankEnrollmentSections(sections)) {
      try {
        const outline = await source.getOutline(
          term,
          department,
          courseNumber,
          section.value,
        );

        return {
          status: "found",
          course: {
            course: requirement.course,
            courseType: requirement.courseType,
            description: outline.info.description,
            prerequisites: outline.info.prerequisites,
            corequisites: outline.info.corequisites,
            outlinePath: outline.info.outlinePath,
            title: outline.info.title,
            year: term.year,
            semester: term.semester,
          },
        };
      } catch (error) {
        if (isHttpNotFound(error)) {
          continue;
        }

        throw error;
      }
    }
  }

  return {
    status: "missing",
    course: requirement.course,
    courseType: requirement.courseType,
  };
}

export async function fetchDegreeCourses(
  source: Pick<CourseOutlineSource, "getSections" | "getOutline">,
  requirements: readonly DegreeRequirementCourse[],
  termHistory: readonly AcademicTerm[],
  concurrency = 5,
): Promise<CourseFetchSummary> {
  const results = await mapWithConcurrency(
    requirements,
    concurrency,
    async (requirement) =>
      fetchCourseOutline(source, requirement, termHistory),
  );

  const courses: EnrichedCourse[] = [];
  const missingCourses: string[] = [];

  for (const result of results) {
    if (result.status === "found") {
      courses.push(result.course);
    } else {
      missingCourses.push(result.course);
    }
  }

  courses.sort((left, right) =>
    left.course < right.course ? -1 : left.course > right.course ? 1 : 0,
  );
  missingCourses.sort();

  return {
    courses,
    missingCourses,
  };
}
