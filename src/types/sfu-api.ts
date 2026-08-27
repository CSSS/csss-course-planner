export const SEMESTERS = ["spring", "summer", "fall"] as const;

export type Semester = (typeof SEMESTERS)[number];

export type AcademicTerm = {
  year: number;
  semester: Semester;
};

export type SfuValue = {
  text?: string;
  value: string;
};

export type SfuSection = {
  text: string;
  value: string;
  title: string;
  classType: string;
  sectionCode: string;
  associatedClass?: string;
};

export type SfuOutlineInfo = {
  description: string;
  prerequisites: string;
  corequisites: string;
  outlinePath: string;
  title: string;
};

export type SfuOutlineResponse = {
  info: SfuOutlineInfo;
  instructor?: unknown[];
  courseSchedule?: unknown[];
  examSchedule?: unknown[];
};
