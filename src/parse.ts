import {
  fillMissingDepartmentCodes,
  removeIrrelevantParentheses,
  removeRecommendations,
  resolveCommas,
  trimLogicalOperators,
  toSyntaxTokens,
} from "./parser/normalization.ts";
import { tokenize } from "./parser/lexer.ts";
import prerequisiteJson from "../prerequisites-1784270712.json" with { type: "json" };
import { RequirementParser } from "./parser/parser.ts";

interface Course {
  course: string;
  courseType:
    | {
        type: "required";
        subtype: "lower" | "upper" | "bsc";
      }
    | {
        type: "elective";
        subtype:
          | "ai"
          | "bsc"
          | "compsys"
          | "infosys"
          | "languages"
          | "macm"
          | "other"
          | "visual";
      };
  description: string;
  prerequisites: string;
  corequisites: string;
  outlinePath: string;
  title: string;
  year: number;
  semester: "spring" | "summer" | "fall";
}

interface PrerequisiteData {
  schemaVersion: number;
  createdAt: number;
  courses: Course[];
}

const data = prerequisiteJson as PrerequisiteData;
for (const course of data.courses) {
  console.log("> " + course.course);
  console.log(course.prerequisites);
  // Lexing
  const tokens = tokenize(course.prerequisites);

  // Normalization
  const requiredTokens = removeRecommendations(course.prerequisites, tokens);
  const fixedTokens = fillMissingDepartmentCodes(requiredTokens);
  const cleanedTokens = removeIrrelevantParentheses(fixedTokens);
  const resolvedTokens = resolveCommas(cleanedTokens);
  const syntaxTokens = toSyntaxTokens(resolvedTokens);
  const finalSyntaxTokens = trimLogicalOperators(syntaxTokens);
  console.dir(finalSyntaxTokens);

  // Parsing
  const parser = new RequirementParser(finalSyntaxTokens);
  console.dir(parser.parse(), { depth: null });
  console.log("\n");
}
