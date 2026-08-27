export type RequiredCourseType = {
  type: "required";
  subtype: "lower" | "upper" | "bsc";
};

export type ElectiveCourseType = {
  type: "elective";
  subtype:
    | "ai"
    | "visual"
    | "compsys"
    | "infosys"
    | "languages"
    | "theoretical"
    | "macm"
    | "other";
};

export type CourseType = RequiredCourseType | ElectiveCourseType;

export type DegreeRequirementCourse = {
  course: string;
  courseType: CourseType;
};

export type DegreeRequirementsFile = {
  schemaVersion: 1;
  createdAt: number;
  courses: DegreeRequirementCourse[];
};
