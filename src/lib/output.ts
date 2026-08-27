import type {
  EnrichedCourse,
  PrerequisitesFile,
} from "../types/prerequisites.ts";

export function createPrerequisitesFile(
  courses: readonly EnrichedCourse[],
  createdAt: number,
): PrerequisitesFile {
  return {
    schemaVersion: 1,
    createdAt,
    courses: [...courses].sort((left, right) =>
      left.course < right.course ? -1 : left.course > right.course ? 1 : 0,
    ),
  };
}

export function getPrerequisitesFileName(createdAt: number): string {
  return `prerequisites-${createdAt}.json`;
}

export function serializePrerequisitesFile(
  prerequisitesFile: PrerequisitesFile,
): string {
  return `${JSON.stringify(prerequisitesFile, null, 2)}\n`;
}
