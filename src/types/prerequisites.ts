import type {
  CourseType,
  DegreeRequirementCourse,
} from "./degree-requirements.ts";
import type { Semester } from "./sfu-api.ts";

export type EnrichedCourse = DegreeRequirementCourse & {
  description: string;
  prerequisites: string;
  corequisites: string;
  outlinePath: string;
  title: string;
  year: number;
  semester: Semester;
};

export type PrerequisitesFile = {
  schemaVersion: 1;
  createdAt: number;
  courses: EnrichedCourse[];
};

export type CourseLookupSuccess = {
  status: "found";
  course: EnrichedCourse;
};

export type CourseLookupMiss = {
  status: "missing";
  course: string;
  courseType: CourseType;
};

export type CourseLookupResult = CourseLookupSuccess | CourseLookupMiss;
