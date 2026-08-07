import type { SyntaxToken, Token } from "./tokens.ts";

/*
 * Made to find recommended classes.
 *
 * e.g. CMPT 310: "...Recommended: MATH 251"
 */
const IGNORED_PATTERNS = /\brecommended\b|\bmay be substituted for\b/i;

type LogicalOperator = "and" | "or";

interface IndexedToken {
  token: Token;
  index: number;
}

function isWhiteSpace(token: Token): boolean {
  return token.kind === "text" && token.value.trim() === "";
}

function isLogicalOperator(token: {
  kind: string;
}): token is { kind: LogicalOperator } {
  return token.kind === "and" || token.kind === "or";
}

/**
 * Decides whether to keep the tokens from a sentence or not.
 */
function processSentence(
  input: string,
  sentenceTokens: Token[],
  keptTokens: Token[],
): void {
  if (sentenceTokens.length === 0) {
    return;
  }

  const first = sentenceTokens[0];
  const last = sentenceTokens.at(-1);
  if (!first || !last) {
    throw new Error("No first or last token found in sentenceTokens");
  }
  const sentenceText = input.slice(first.start, last.end);

  // If the input doesn't contain the recommended sentence, there is no processing needed.
  if (!IGNORED_PATTERNS.test(sentenceText)) {
    keptTokens.push(...sentenceTokens);
  }

  // Clear the array
  sentenceTokens.length = 0;
}

/**
 * Removes the recommended portion of the sentence.
 *
 * e.g CMPT 310: CMPT 225 and STAT 271, all with a minimum grade of C-. Recommended: MATH 251.
 * The `Recommended: MATH 251` portion would be removed.
 * @param input - the prerequisite string
 * @param tokens - the tokens of the prerequisite string
 * @returns tokens without the recommended portion
 */
export function removeRecommendations(input: string, tokens: Token[]): Token[] {
  const result: Token[] = [];
  let sentenceTokens: Token[] = [];

  try {
    for (const token of tokens) {
      sentenceTokens.push(token);
      const isPeriod = token.kind === "period";

      // To determine if something is a sentence, there must be a period and a space afterwards.
      const isSentenceBoundary =
        isPeriod &&
        (token.end === input.length || /\s/.test(input[token.end] ?? ""));

      if (isSentenceBoundary) {
        processSentence(input, sentenceTokens, result);
      }
    }

    // This is to handle cases where there is a missing period at the end of the prerequisite
    // e.g. CMPT 467
    processSentence(input, sentenceTokens, result);
  } catch (error) {
    console.error(error);
  }

  return result;
}

/**
 * Takes the tokens and makes a pass through them, fixing courses that didn't have a department in front of them.
 *
 * e.g. MACM 316 prerequisites: MATH 152 or 155 or 158...
 * The tokenizer will know about MATH 152, but 155 and 158 don't have departments attached.
 * @param tokens - tokens from the tokenizer
 * @returns tokens with missing departments added
 */
export function fillMissingDepartmentCodes(tokens: Token[]): Token[] {
  let currentDepartment: string | undefined;
  let previousKind: Token["kind"] | undefined;
  const result: Token[] = [];

  for (const token of tokens) {
    // These should be <department> <code>
    if (token.kind === "course") {
      currentDepartment = token.value.split(/\s+/)[0];
      previousKind = "course";
      result.push(token);
      continue;
    }

    // These should be missing the departments
    if (
      token.kind === "number" &&
      currentDepartment &&
      (previousKind === "and" ||
        previousKind === "or" ||
        previousKind === "comma")
    ) {
      // Assume this one's department is the same as the last mentioned department.
      result.push({
        kind: "course",
        value: `${currentDepartment} ${token.value}`,
        start: token.start,
        end: token.end,
      });

      previousKind = "course";
      continue;
    }

    // These are other, irrelevant tokens
    if (token.kind !== "text" || token.value.trim() !== "") {
      previousKind = token.kind;
    }
    result.push(token);
  }

  return result;
}

function isLParen(token: Token) {
  return token.kind === "lparen";
}

function isRParen(token: Token) {
  return token.kind === "rparen";
}

function findMatchingParenthesis(
  tokens: Token[],
  startIndex: number,
): number | undefined {
  let depth = 0;

  for (let i = startIndex; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token) {
      continue;
    }

    if (isLParen(token)) {
      depth++;
    } else if (isRParen(token)) {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  // Lord help us if this is reached.
  return undefined;
}

/**
 * Removes things like `(or equivalent)` from tokens.
 *
 * e.g. MATH 150: Pre-Calculus 12 (or equivalent) with a grade of at least B+, or MATH 100 with a grade of at least B-
 *
 * That would produce tokens like: \['(', 'or', ')'\] which isn't relevant.
 *
 * @param tokens - tokens to remove the from
 * @returns tokens without the irrelavant parentheses blobs
 */
export function removeIrrelevantParentheses(tokens: Token[]): Token[] {
  const result: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token) {
      continue;
    }

    if (!isLParen(token)) {
      result.push(token);
      continue;
    }

    const closingIndex = findMatchingParenthesis(tokens, i);

    if (closingIndex === undefined) {
      result.push(token);
      console.warn(`Found unmatched parenthesis at index ${i}`);
      continue;
    }

    const closingToken = tokens[closingIndex];
    if (!closingToken) {
      result.push(token);
      continue;
    }

    // In case there are nested parentheses
    const innerTokens = removeIrrelevantParentheses(
      tokens.slice(i + 1, closingIndex),
    );

    const containsCourse = innerTokens.some((t) => t.kind === "course");

    if (containsCourse) {
      result.push(token, ...innerTokens, closingToken);
    }

    // Skip the entire closing parentheses blob
    i = closingIndex;
  }

  return result;
}

function previousSignificantToken(
  tokens: Token[],
  beforeIndex: number,
): IndexedToken | undefined {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token && !isWhiteSpace(token)) {
      return { token, index: i };
    }
  }

  return undefined;
}

function nextSignificantToken(
  tokens: Token[],
  afterIndex: number,
): IndexedToken | undefined {
  for (let i = afterIndex + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token && !isWhiteSpace(token)) {
      return { token, index: i };
    }
  }

  return undefined;
}

function canEndRequirement(token: Token): boolean {
  return token.kind === "course" || token.kind === "rparen";
}

function canStartRequirement(token: Token): boolean {
  return token.kind === "course" || token.kind === "lparen";
}

/**
 * Determines if a comma is structural.
 * A comma is structural when it separates two course requirements.
 *
 * e.g. CMPT 433: (CMPT 201 or CMPT 300) and CMPT 295, with a minimum grade of C-.
 * The comma after CMPT 295 is structural, not logical.
 */
function isStructuralComma(tokens: Token[], commaIndex: number): boolean {
  const previous = previousSignificantToken(tokens, commaIndex);
  let next = nextSignificantToken(tokens, commaIndex);

  if (!previous || !next || !canEndRequirement(previous.token)) {
    return false;
  }

  // Allow the final comma in an Oxford list: `A, B, and C`.
  if (next.token.kind === "and" || next.token.kind === "or") {
    next = nextSignificantToken(tokens, next.index);
  }

  return next !== undefined && canStartRequirement(next.token);
}

function getTopLevelCommaIndices(tokens: Token[]): number[] {
  const result: number[] = [];
  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) {
      continue;
    }

    if (token.kind === "lparen") {
      depth++;
    } else if (token.kind === "rparen") {
      depth--;
    } else if (depth === 0 && token.kind === "comma") {
      result.push(i);
    }
  }

  return result;
}

function getTopLevelInformation(tokens: Token[]): {
  text: string;
  operators: Set<LogicalOperator>;
} {
  const text: string[] = [];
  const operators = new Set<LogicalOperator>();
  let depth = 0;

  for (const token of tokens) {
    if (token.kind === "lparen") {
      depth++;
      continue;
    }

    if (token.kind === "rparen") {
      depth--;
      continue;
    }

    if (depth !== 0) {
      continue;
    }

    if (token.kind === "text") {
      text.push(token.value);
    } else if (token.kind === "and" || token.kind === "or") {
      operators.add(token.kind);
    }
  }

  return { text: text.join(" "), operators };
}

function getOnlyOperator(
  operators: Set<LogicalOperator>,
): LogicalOperator | undefined {
  if (operators.size !== 1) {
    return undefined;
  }

  return operators.values().next().value;
}

/** Resolves commas in one sentence or semicolon-delimited clause. */
function resolveCommaClause(tokens: Token[]): Token[] {
  const commaIndices = getTopLevelCommaIndices(tokens);
  const commaIndexSet = new Set(commaIndices);
  const structuralCommaIndices = commaIndices.filter((index) =>
    isStructuralComma(tokens, index),
  );
  const structuralCommaIndexSet = new Set(structuralCommaIndices);

  if (structuralCommaIndices.length === 0) {
    // At this point, commas that do not separate requirements are only prose
    // punctuation and can be discarded.
    return tokens.filter(
      (token, index) => token.kind !== "comma" || !commaIndexSet.has(index),
    );
  }

  // An explicit connector after a comma is the strongest clue. This handles
  // Oxford lists as well as mixed expressions such as `A, B or C, and D`.
  const explicitOperators = new Set<LogicalOperator>();
  for (const commaIndex of structuralCommaIndices) {
    const next = nextSignificantToken(tokens, commaIndex);
    if (next?.token.kind === "and" || next?.token.kind === "or") {
      explicitOperators.add(next.token.kind);
    }
  }

  let replacement = getOnlyOperator(explicitOperators);
  const { text, operators } = getTopLevelInformation(tokens);

  if (!replacement && /\b(?:one|any)\s+of\b/i.test(text)) {
    replacement = "or";
  }

  // These phrases describe a grade condition shared by every item, which is
  // evidence that all of the comma-separated requirements are required.
  if (!replacement && /\b(?:all|both)\s+with\b/i.test(text)) {
    replacement = "and";
  }

  // Non-Oxford lists inherit their one unambiguous top-level connector:
  // `A, B or C` becomes `A or B or C`.
  if (!replacement) {
    replacement = getOnlyOperator(operators);
  }

  if (!replacement) {
    const firstComma = tokens[structuralCommaIndices[0] ?? -1];
    console.warn(
      `Could not resolve comma at character ${firstComma?.start ?? "unknown"}`,
    );
  }

  const operatorsToSkip = new Set<number>();
  if (replacement) {
    for (const commaIndex of structuralCommaIndices) {
      const next = nextSignificantToken(tokens, commaIndex);
      if (next?.token.kind === replacement) {
        // The replacement occupies the comma's position, so retaining the
        // explicit Oxford-list connector would produce two operators.
        operatorsToSkip.add(next.index);
      }
    }
  }

  const result: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || operatorsToSkip.has(i)) {
      continue;
    }

    if (!commaIndexSet.has(i)) {
      result.push(token);
      continue;
    }

    if (structuralCommaIndexSet.has(i)) {
      result.push(
        replacement
          ? { kind: replacement, start: token.start, end: token.end }
          : token,
      );
    }
    // Non-structural commas are prose punctuation and are omitted.
  }

  return result;
}

/**
 * Resolves commas one sentence/semicolon-delimited clause at a time so an
 * operator in a later clause cannot change an earlier list.
 */
function resolveCommasAtCurrentLevel(tokens: Token[]): Token[] {
  const result: Token[] = [];
  let clauseStart = 0;
  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) {
      continue;
    }

    if (token.kind === "lparen") {
      depth++;
    } else if (token.kind === "rparen") {
      depth--;
    }

    const isBoundary =
      depth === 0 && (token.kind === "period" || token.kind === "semicolon");

    if (isBoundary) {
      result.push(...resolveCommaClause(tokens.slice(clauseStart, i)), token);
      clauseStart = i + 1;
    }
  }

  result.push(...resolveCommaClause(tokens.slice(clauseStart)));
  return result;
}

/**
 * Replaces commas between course requirements with AND or OR tokens.
 * Nested parenthesized expressions are resolved independently from their parents.
 */
export function resolveCommas(tokens: Token[]): Token[] {
  const nestedResolved: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) {
      continue;
    }

    if (token.kind !== "lparen") {
      nestedResolved.push(token);
      continue;
    }

    const closingIndex = findMatchingParenthesis(tokens, i);
    if (closingIndex === undefined) {
      console.warn(`Found unmatched parenthesis at index ${i}`);
      nestedResolved.push(token);
      continue;
    }

    const closingToken = tokens[closingIndex];
    if (!closingToken) {
      nestedResolved.push(token);
      continue;
    }

    nestedResolved.push(
      token,
      ...resolveCommas(tokens.slice(i + 1, closingIndex)),
      closingToken,
    );
    i = closingIndex;
  }

  return resolveCommasAtCurrentLevel(nestedResolved);
}

/**
 * Changes the tokens to something more easily consumed by the parser.
 * @param tokens - Tokens to convert.
 * @returns an array of syntax tokens
 */
export function toSyntaxTokens(tokens: Token[]): SyntaxToken[] {
  const result: SyntaxToken[] = [];

  for (const token of tokens) {
    switch (token.kind) {
      case "course":
        result.push({
          kind: "course",
          code: token.value,
        });
        break;
      case "and":
      case "or":
      case "comma":
      case "lparen":
      case "rparen":
        result.push({ kind: token.kind });
        break;
      case "semicolon":
      case "period":
        break;
      case "text":
        const text = token.value.trim();
        if (text !== "") {
          console.info(`Ignored token: ${text}`);
        }
        break;
      default:
        console.warn(`Unexpected token: ${token.value}`);
    }
  }

  return result;
}

export function trimLogicalOperators(tokens: SyntaxToken[]): SyntaxToken[] {
  let start = 0;
  let end = tokens.length;

  if (tokens.length === 0) {
    return tokens;
  }

  // The bang is there because TypeScript thinks tokens[start] could be undefined
  while (start < end && isLogicalOperator(tokens[start]!)) {
    start++;
  }

  while (end > start && isLogicalOperator(tokens[end - 1]!)) {
    end--;
  }

  return tokens.slice(start, end);
}
