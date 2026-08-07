import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tokenize } from "./parser/lexer.ts";
import {
  fillMissingDepartmentCodes,
  removeIrrelevantParentheses,
  removeRecommendations,
  resolveCommas,
  toSyntaxTokens,
  trimLogicalOperators,
} from "./parser/normalization.ts";
import { RequirementParser } from "./parser/parser.ts";

type ExpectedRequirement =
  | { kind: "course"; code: string }
  | {
      kind: "allOf" | "anyOf";
      items: ExpectedRequirement[];
    };

function course(code: string): ExpectedRequirement {
  return { kind: "course", code };
}

function allOf(...items: ExpectedRequirement[]): ExpectedRequirement {
  return { kind: "allOf", items };
}

function anyOf(...items: ExpectedRequirement[]): ExpectedRequirement {
  return { kind: "anyOf", items };
}

function parsePrerequisite(input: string) {
  const tokens = tokenize(input);
  const requiredTokens = removeRecommendations(input, tokens);
  const fixedTokens = fillMissingDepartmentCodes(requiredTokens);
  const cleanedTokens = removeIrrelevantParentheses(fixedTokens);
  const resolvedTokens = resolveCommas(cleanedTokens);
  const syntaxTokens = toSyntaxTokens(resolvedTokens);
  const finalSyntaxTokens = trimLogicalOperators(syntaxTokens);

  return new RequirementParser(finalSyntaxTokens).parse();
}

describe("prerequisite parsing", () => {
  it("CMPT 125: parses a basic OR and ignores a grade modifier", () => {
    const input = "CMPT 120 or CMPT 130, with a minimum grade of C-.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      anyOf(course("CMPT 120"), course("CMPT 130")),
    );
  });

  it("CMPT 210: resolves Oxford commas without merging inner OR groups", () => {
    const input =
      "MACM 101, MATH 152, CMPT 125 or CMPT 135, and (MATH 240 or MATH 232), all with a minimum grade of C-.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      allOf(
        course("MACM 101"),
        course("MATH 152"),
        anyOf(course("CMPT 125"), course("CMPT 135")),
        anyOf(course("MATH 240"), course("MATH 232")),
      ),
    );
  });

  it("CMPT 225: resolves a non-Oxford comma inside nested alternatives", () => {
    const input =
      "(MACM 101 and (CMPT 125, CMPT 129 or CMPT 135)) or (ENSC 251 and ENSC 252), all with a minimum grade of C-.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      anyOf(
        allOf(
          course("MACM 101"),
          anyOf(course("CMPT 125"), course("CMPT 129"), course("CMPT 135")),
        ),
        allOf(course("ENSC 251"), course("ENSC 252")),
      ),
    );
  });

  it("CMPT 310: removes a recommendation containing a course", () => {
    const input =
      "CMPT 225 and STAT 271, all with a minimum grade of C-. Recommended: MATH 251.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      allOf(course("CMPT 225"), course("STAT 271")),
    );
  });

  it("CMPT 340: resolves a comma-only 'one of' list and fills departments", () => {
    const input =
      "Completion of 60 units including one of CMPT 125, 126, 128, 135, with a minimum grade of C- or CMPT 102 with a grade of B or higher.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      anyOf(
        course("CMPT 125"),
        course("CMPT 126"),
        course("CMPT 128"),
        course("CMPT 135"),
        course("CMPT 102"),
      ),
    );
  });

  it("CMPT 353: resolves an Oxford OR list inside an AND expression", () => {
    const input =
      "CMPT 225 and (BUS 232, STAT 201, STAT 203, STAT 205, STAT 270, STAT 271, ENSC 280, MSE 210, or SEE 241), with a minimum grade of C-.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      allOf(
        course("CMPT 225"),
        anyOf(
          course("BUS 232"),
          course("STAT 201"),
          course("STAT 203"),
          course("STAT 205"),
          course("STAT 270"),
          course("STAT 271"),
          course("ENSC 280"),
          course("MSE 210"),
          course("SEE 241"),
        ),
      ),
    );
  });

  it("CMPT 420: binds the course choice more tightly than the comma-derived AND", () => {
    const input =
      "CMPT 310, CMPT 410 or CMPT 419 (Machine Learning), both with a minimum grade of C-.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      allOf(course("CMPT 310"), anyOf(course("CMPT 410"), course("CMPT 419"))),
    );
  });

  it("CMPT 475: joins two alternative groups with a non-Oxford comma", () => {
    const input =
      "CMPT 275 or CMPT 276, (MACM 201 or CMPT 210), all with a minimum grade of C- and 15 units of upper division courses. Recommended: Co-op experience.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      allOf(
        anyOf(course("CMPT 275"), course("CMPT 276")),
        anyOf(course("MACM 201"), course("CMPT 210")),
      ),
    );
  });

  it("MACM 316: fills repeated departments and trims an operator before ignored recommendation", () => {
    const input =
      "MATH 152 or 155 or 158, and MATH 232 or 240, and computing experience.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      allOf(
        anyOf(course("MATH 152"), course("MATH 155"), course("MATH 158")),
        anyOf(course("MATH 232"), course("MATH 240")),
      ),
    );
  });

  it("MACM 401: preserves deeply nested alternatives and conjunctions", () => {
    const input =
      "CMPT 307 or ((MATH 340 or MATH 342) and (CMPT 225 or MACM 204)).";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      anyOf(
        course("CMPT 307"),
        allOf(
          anyOf(course("MATH 340"), course("MATH 342")),
          anyOf(course("CMPT 225"), course("MACM 204")),
        ),
      ),
    );
  });

  it("MACM 442: treats semicolon OR as lower precedence than AND", () => {
    const input =
      "(CMPT 201 or 225) and one of (MATH 340 or 332 or 342); or CMPT 405.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      anyOf(
        allOf(
          anyOf(course("CMPT 201"), course("CMPT 225")),
          anyOf(course("MATH 340"), course("MATH 332"), course("MATH 342")),
        ),
        course("CMPT 405"),
      ),
    );
  });

  it("MATH 308: separates two OR lists with AND", () => {
    const input =
      "MATH 150, 151, 154, or 157 and MATH 240 or 232, all with a minimum grade of C-.";

    assert.deepStrictEqual(
      parsePrerequisite(input),
      allOf(
        anyOf(
          course("MATH 150"),
          course("MATH 151"),
          course("MATH 154"),
          course("MATH 157"),
        ),
        anyOf(course("MATH 240"), course("MATH 232")),
      ),
    );
  });
});
