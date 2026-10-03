import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { and, eq } from "drizzle-orm";
import { compareTerms } from "../lib/terms.ts";
import type { AcademicTerm } from "../types/sfu-api.ts";
import { course, courseSection } from "./tables.ts";

export type CourseInfo = {
  course: typeof course.$inferSelect;
  sections: (typeof courseSection.$inferSelect)[];
};

export class DatabaseObject {
  private client: DatabaseSync;
  private db;

  constructor(fileLocation: string) {
    if (!fileLocation.trim()) throw new Error("A database file path is required.");
    this.client = new DatabaseSync(resolve(fileLocation));
    try {
      this.client.exec("PRAGMA foreign_keys = ON");
      this.db = drizzle({ client: this.client });
    } catch (error) {
      this.client.close();
      throw error;
    }
  }

  public get(code: string, term: AcademicTerm | undefined, latestAllowed: AcademicTerm): CourseInfo | undefined {
    const saved = this.db.select().from(course).where(eq(course.course_code, code)).get();
    if (!saved) return undefined;
    const sections = this.db.select().from(courseSection)
      .where(eq(courseSection.course_code, code)).all();
    const selectedTerm = term ?? sections
      .filter((section) => compareTerms(section, latestAllowed) <= 0)
      .sort((a, b) => compareTerms(b, a))[0];
    const matching = sections.filter((section) => selectedTerm && compareTerms(section, selectedTerm) === 0);
    return matching.length ? { course: saved, sections: matching } : undefined;
  }

  public save(values: typeof course.$inferInsert,
    sections: (typeof courseSection.$inferInsert)[], term: AcademicTerm): CourseInfo {
    return this.db.transaction((tx) => {
      const saved = tx.insert(course).values(values).onConflictDoUpdate({
        target: course.course_code, set: values,
      }).returning().get();
      if (!saved) throw new Error(`Failed to save ${values.course_code}`);
      for (const section of sections) {
        tx.insert(courseSection).values(section).onConflictDoUpdate({
          target: [courseSection.course_code, courseSection.year,
            courseSection.semester, courseSection.section_code],
          set: section,
        }).run();
      }
      return { course: saved, sections: tx.select().from(courseSection).where(and(
        eq(courseSection.course_code, values.course_code), eq(courseSection.year, term.year),
        eq(courseSection.semester, term.semester),
      )).all() };
    });
  }

  public close(): void {
    if (this.client.isOpen) this.client.close();
  }
}
