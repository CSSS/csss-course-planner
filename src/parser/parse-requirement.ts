import { tokenize } from "./lexer.ts";
import { RequirementParser } from "./parser.ts";
import {
  fillMissingDepartmentCodes, removeIrrelevantParentheses,
  removeRecommendations, resolveCommas, toSyntaxTokens, trimLogicalOperators,
} from "./normalization.ts";

export function parseRequirement(raw: string) {
  const required = removeRecommendations(raw, tokenize(raw));
  const filled = fillMissingDepartmentCodes(required);
  const cleaned = removeIrrelevantParentheses(filled);
  const tokens = trimLogicalOperators(toSyntaxTokens(resolveCommas(cleaned)));
  return new RequirementParser(tokens).parse() ?? null;
}
