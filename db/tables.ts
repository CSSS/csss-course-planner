import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Semester } from "../src/types/sfu-api.ts";
import type { Requirement } from "../src/parser/parser.ts";

export const course = sqliteTable("course", {
  course_code: text("course_code").primaryKey(),
  title: text("title"),
  description: text("description"),
  prerequisites_raw: text("prerequisites_raw"),
  prerequisites: text("prerequisites", { mode: "json" }).$type<Requirement>(),
  corequisites_raw: text("corequisites_raw"),
  corequisites: text("corequisites", { mode: "json" }).$type<Requirement>(),
  degree_level: text("degree_level"),
  dept: text("dept"),
  designation: text("designation"),
  number: text("number"),
  units: integer("units"),
});

export const courseSection = sqliteTable("course_section", {
  course_code: text("course_code").notNull()
    .references(() => course.course_code, { onUpdate: "cascade" }),
  section_code: text("section_code").notNull(),
  year: integer("year").notNull(),
  semester: text("semester").$type<Semester>().notNull(),
  primary_instructors: text("primary_instructors", { mode: "json" })
    .$type<string[]>().notNull().default(sql`'[]'`),
  secondary_instructors: text("secondary_instructors", { mode: "json" })
    .$type<string[]>().notNull().default(sql`'[]'`),
  delivery_method: text("delivery_method"),
  notes: text("notes"),
}, (table) => [
  primaryKey({ columns: [
    table.course_code, table.year, table.semester, table.section_code,
  ] }),
]);
