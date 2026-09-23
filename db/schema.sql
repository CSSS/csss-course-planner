-- Run this once when creating a new local database.
PRAGMA foreign_keys = ON;

CREATE TABLE course (
  course_code TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  prerequisites_raw TEXT,
  prerequisites TEXT,
  corequisites_raw TEXT,
  corequisites TEXT,
  degree_level TEXT,
  dept TEXT,
  designation TEXT,
  number TEXT,
  units INTEGER
);

CREATE TABLE course_section (
  course_code TEXT NOT NULL
    REFERENCES course(course_code) ON UPDATE CASCADE,
  section_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  semester TEXT NOT NULL,
  primary_instructors TEXT NOT NULL DEFAULT '[]',
  secondary_instructors TEXT NOT NULL DEFAULT '[]',
  delivery_method TEXT,
  notes TEXT,

  PRIMARY KEY (course_code, year, semester, section_code)
);
