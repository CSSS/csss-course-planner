import type { Token } from "./tokens.ts";

const TOKEN_PATTERN =
  /(?<course>\b[A-Z]{2,5}(?:\s*\/\s*[A-Z]{2,5})?\s+\d{3}[A-Z]?\b)|(?<number>\b\d{3}[A-Z]?\b)|(?<and>\band\b)|(?<or>\bor\b)|(?<comma>,)|(?<lparen>\()|(?<rparen>\))|(?<semicolon>;)|(?<period>\.)/g;

/**
 * Goes through the prerequisites and pulls out only the objects that are `Token`s.
 * Anything irrelevant is stripped awau.
 * @param input - the prerequisite string
 * @returns an array of `Token`s
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of input.matchAll(TOKEN_PATTERN)) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > cursor) {
      tokens.push({
        kind: "text",
        value: input.slice(cursor, start),
        start: cursor,
        end: start,
      });
    }

    if (match.groups?.["course"]) {
      tokens.push({
        kind: "course",
        value: match[0].replace(/\s+/g, " "),
        start,
        end,
      });
    } else if (match.groups?.["number"]) {
      tokens.push({
        kind: "number",
        value: match[0],
        start,
        end,
      });
    } else if (match.groups?.["and"]) {
      tokens.push({ kind: "and", start, end });
    } else if (match.groups?.["or"]) {
      tokens.push({ kind: "or", start, end });
    } else if (match.groups?.["comma"]) {
      tokens.push({ kind: "comma", start, end });
    } else if (match.groups?.["lparen"]) {
      tokens.push({ kind: "lparen", start, end });
    } else if (match.groups?.["rparen"]) {
      tokens.push({ kind: "rparen", start, end });
    } else if (match.groups?.["semicolon"]) {
      tokens.push({ kind: "semicolon", start, end });
    } else if (match.groups?.["period"]) {
      tokens.push({ kind: "period", start, end });
    } else {
      console.warn(`Unexpected token: ${match[0]} at index ${start}`);
    }
    cursor = end;
  }

  if (cursor < input.length) {
    tokens.push({
      kind: "text",
      value: input.slice(cursor),
      start: cursor,
      end: input.length,
    });
  }

  return tokens;
}
