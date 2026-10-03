import { parseCourseCode } from "./lib/course-fetcher.ts";
import { isHttpNotFound } from "./lib/http-client.ts";
import { SfuClient } from "./lib/sfu-client.ts";
import { discoverTermHistory } from "./lib/term-history.ts";
import { getCurrentAcademicTerm, isSemester } from "./lib/terms.ts";
import { parseRequirement } from "./parser/parse-requirement.ts";
import type { AcademicTerm } from "./types/sfu-api.ts";
import { DatabaseObject, type CourseInfo } from "./db/database.ts";

export const DEFAULT_TTL_IN_MS = 60 * 60 * 1000;

function validateRequest(code: string, term?: AcademicTerm) {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, " ");
  parseCourseCode(normalized);
  if (term && (!Number.isInteger(term.year) || term.year < 1 || !isSemester(term.semester))) {
    throw new Error("Expected a valid year and spring, summer, or fall semester.");
  }
  return normalized;
}

// Unknown instructor roles are not guessed.
function instructors(values: unknown[] | undefined, roleCode: "PI" | "SI"): string[] {
  return (values ?? []).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as Record<string, unknown>;
    return typeof entry.name === "string" && entry.name.trim()
      && typeof entry.roleCode === "string"
      && entry.roleCode.trim().toUpperCase() === roleCode ? [entry.name.trim()] : [];
  });
}

function parseUnits(value: string | number | undefined): number | null {
  if (value === undefined || (typeof value === "string" && !value.trim())) return null;
  const units = Number(value);
  return Number.isFinite(units) && units >= 0 ? units : null;
}


export class SfuCourses {
  private ttl: number;
  private database: DatabaseObject;
  private source: SfuClient;

  constructor(fileLocation: string, ttl = DEFAULT_TTL_IN_MS) {
    if (!Number.isFinite(ttl) || ttl < 0) {
      throw new Error("Cache TTL must be a finite, non-negative number of milliseconds.");
    }
    this.ttl = ttl;
    this.source = new SfuClient();
    this.database = new DatabaseObject(fileLocation);
  }

  public async getCourseInfo(courseCode: string, term?: AcademicTerm): Promise<CourseInfo | undefined> {
    const code = validateRequest(courseCode, term);
    const cached = this.getCachedData(code, term);
    if (cached && !this.isStale(cached.course.last_updated)) return cached;
    return this.fetchAndParse(code, term);
  }

  // Freshness is tracked on per course basis.
  private isStale(lastFetch: Date | null): boolean {
    if (!lastFetch) return true;
    const age = Date.now() - lastFetch.getTime();
    return age < 0 || age >= this.ttl;
  }

  private getCachedData(code: string, term?: AcademicTerm): CourseInfo | undefined {
    return this.database.get(code, term, getCurrentAcademicTerm(new Date()));
  }

  private async fetchAndParse(courseCode: string, term?: AcademicTerm): Promise<CourseInfo | undefined> {
    const code = validateRequest(courseCode, term);
    const { department, courseNumber } = parseCourseCode(code);
    const source = this.source;
    const terms = term ? [term] : await discoverTermHistory(source, getCurrentAcademicTerm(new Date()));
  
    for (const offering of terms) {
      let sections;
      try {
        sections = await source.getSections(offering, department, courseNumber);
      } catch (error) {
        if (isHttpNotFound(error)) continue;
        throw error;
      }

      // discard non-lecture sections as we dont care about them right now can change in the future
      sections = sections.filter((section) => section.classType === "e"
        && section.sectionCode === "LEC");
      if (!sections.length) continue;
      const outlines = [];
      for (const section of sections) {
        try {
          outlines.push({ section, outline: await source.getOutline(
            offering, department, courseNumber, section.value,
          ) });
        } catch (error) {
          if (isHttpNotFound(error)) continue;
          throw error;
        }
      }
      const selected = outlines[0];
      if (!selected) continue;
      const info = selected.outline.info;
      const values = {
        course_code: code, title: info.title, description: info.description,
        prerequisites_raw: info.prerequisites ?? "",
        prerequisites: parseRequirement(info.prerequisites ?? ""),
        corequisites_raw: info.corequisites ?? "",
        corequisites: parseRequirement(info.corequisites ?? ""),
        dept: department, number: courseNumber, last_updated: new Date(),
         degree_level: info.degreeLevel ?? null,
        designation: info.designation ?? null,
        units: parseUnits(info.units),
      };
      const sectionValues = outlines.map(({ section, outline }) => ({
        course_code: code, section_code: section.value,
        year: offering.year, semester: offering.semester,
        primary_instructors: instructors(outline.instructor, "PI"),
        secondary_instructors: instructors(outline.instructor, "SI"),
        delivery_method: outline.info.deliveryMethod ?? null,
        notes: outline.info.notes ?? null,
      }));
  
      return this.database.save(values, sectionValues, offering);
    }
    return undefined;
  }

  public close(): void {
    this.database.close();
  }
}

