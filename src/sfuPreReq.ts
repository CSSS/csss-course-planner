type Prereq = string | Prereq[];
type PrereqGroups = Prereq[][];
function mergeOr(left: PrereqGroups, right: PrereqGroups): PrereqGroups {
  return [...left, ...right];
}
function collapse(groups: PrereqGroups): Prereq[] {
  if (groups.length === 1) {
    return groups[0];
  }

  return [groups.map((group) => (group.length === 1 ? group[0] : group))];
}

function mergeAnd(left: PrereqGroups, right: PrereqGroups): PrereqGroups {
  return [[...collapse(left), ...collapse(right)]];
}

function fillMissingCourseIdentifiers(chunks: string[]): string[] {
  let mostRecentIdentifier: string | undefined;

  return chunks.map((chunk) => {
    const identifiedCourse = chunk.match(/^([A-Z]{3,4})\s*\d{3}$/);

    if (identifiedCourse) {
      mostRecentIdentifier = identifiedCourse[1];
      return chunk;
    }

    if (/^\d{3}$/.test(chunk) && mostRecentIdentifier) {
      return `${mostRecentIdentifier} ${chunk}`;
    }

    return chunk;
  });
}

function isCourse(chunk: string | undefined): boolean {
  return chunk !== undefined && /^([A-Z]{3,4}\s*)?\d{3}$/.test(chunk);
}

function removeUnconnectedTrailingText(chunks: string[]): string[] {
  for (let i = 1; i < chunks.length; i++) {
    const previousChunk = chunks[i - 1];
    const currentChunk = chunks[i];

    const previousRequirementIsComplete =
      isCourse(previousChunk) || previousChunk === ")";
    const newRequirementIsStarting =
      isCourse(currentChunk) || currentChunk === "(";

    // Two requirements must have a "," "and", or "or" between them.
    // If they do not, the second one came from unrelated trailing text.
    if (previousRequirementIsComplete && newRequirementIsStarting) {
      return chunks.slice(0, i);
    }
  }

  return chunks;
}

function isOperator(chunk: string | undefined): boolean {
  return chunk === "and" || chunk === "or";
}

function hasTopLevelOr(chunks: string[]): boolean {
  let depth = 0;

  // Only look for "or" outside of nested parentheses.
  for (const chunk of chunks) {
    if (chunk === "(") {
      depth++;
    } else if (chunk === ")") {
      depth--;
    } else if (chunk === "or" && depth === 0) {
      return true;
    }
  }

  return false;
}

function findClosingParenthesis(chunks: string[], start: number): number {
  let depth = 1;

  // Find the closing parenthesis that matches the opening one at `start`.
  for (let i = start + 1; i < chunks.length; i++) {
    if (chunks[i] === "(") {
      depth++;
    } else if (chunks[i] === ")") {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  return chunks.length;
}

function fillCommaOperators(chunks: string[]): string[] {
  const normalizedChunks: string[] = [];

  // Handle commas inside parentheses separately from the outer expression.
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i] !== "(") {
      normalizedChunks.push(chunks[i]);
      continue;
    }

    const closingIndex = findClosingParenthesis(chunks, i);
    const insideParentheses = chunks.slice(i + 1, closingIndex);

    normalizedChunks.push("(");
    // Recursively fill commas inside the parentheses before adding back to the outer expression.
    normalizedChunks.push(...fillCommaOperators(insideParentheses));

    if (closingIndex < chunks.length) {
      normalizedChunks.push(")");
    }

    i = closingIndex;
  }

  const commaIndexes: number[] = [];
  const operatorIndexes: number[] = [];
  let depth = 0;

  // Collect commas and operators that are at this parenthesis level.
  for (let i = 0; i < normalizedChunks.length; i++) {
    if (normalizedChunks[i] === "(") {
      depth++;
    } else if (normalizedChunks[i] === ")") {
      depth--;
    } else if (depth === 0 && normalizedChunks[i] === ",") {
      commaIndexes.push(i);
    } else if (depth === 0 && isOperator(normalizedChunks[i])) {
      operatorIndexes.push(i);
    }
  }

  if (commaIndexes.length === 0) {
    return normalizedChunks;
  }

  let listOperator = "";

  // Comma logic to find what to replace comma with on the current level, this might need to be changed as im assuming for some of this logic:
  // Case 1: "A, B, and C" uses "and", while "A, B, or C" uses "or".
  for (const commaIndex of commaIndexes) {
    const nextChunk = normalizedChunks[commaIndex + 1];

    if (isOperator(nextChunk)) {
      listOperator = nextChunk;
      break;
    }
  }

  // Case 2: "A, B or C" uses "or"
  if (listOperator === "") {
    const firstCommaIndex = commaIndexes[0];

    for (const operatorIndex of operatorIndexes) {
      if (operatorIndex > firstCommaIndex) {
        listOperator = normalizedChunks[operatorIndex];
        break;
      }
    }
  }

  // Case 3: "A or B, C" uses "or"
  if (listOperator === "" && operatorIndexes.length > 0) {
    const lastOperatorIndex = operatorIndexes[operatorIndexes.length - 1];
    listOperator = normalizedChunks[lastOperatorIndex];
  }

  // Case 4: Use "and" as fallback
  if (listOperator === "") {
    listOperator = "and";
  }

  const segments: string[][] = [];
  let segmentStart = 0;

  // Split the expression into the pieces found between the commas.
  for (const commaIndex of commaIndexes) {
    segments.push(normalizedChunks.slice(segmentStart, commaIndex));
    segmentStart = commaIndex + 1;
  }

  segments.push(normalizedChunks.slice(segmentStart));

  const result: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    let segment = segments[i];

    if (i > 0 && isOperator(segment[0])) {
      segment = segment.slice(1);
    }

    if (i > 0) {
      result.push(listOperator);
    }

    // Keep an OR choice together when it is one item in an AND list.
    // "A, B or C, and D" becomes "A and (B or C) and D".
    if (listOperator === "and" && hasTopLevelOr(segment)) {
      result.push("(");
      result.push(...segment);
      result.push(")");
    } else {
      result.push(...segment);
    }
  }

  return result;
}

function extractPrereqs(text: string): Prereq {
  const regex = /[A-Z]{3,4}\s*\d{3}|\d{3}|or|and|,|\(|\)/g;
  const matches = text.match(regex);
  if (!matches || matches.length < 3) {
    return [];
  }
  console.log(matches);
  const connectedChunks = removeUnconnectedTrailingText(matches);
  const chunks = fillCommaOperators(
    fillMissingCourseIdentifiers(connectedChunks),
  );
  const prereqs = recursiveOrAndBreakdown(chunks);
  return prereqs;
}

function recursiveOrAndBreakdown(chunks: string[]): PrereqGroups {
  let depth = 0;
  let orIndex = -1;
  let andIndex = -1;

  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i] === "(") {
      depth++;
    } else if (chunks[i] === ")") {
      depth--;
    } else if (chunks[i] === "or" && depth === 0 && orIndex === -1) {
      orIndex = i;
    } else if (chunks[i] === "and" && depth === 0 && andIndex === -1) {
      andIndex = i;
    }
  }

  if (orIndex !== -1) {
    return mergeOr(
      recursiveOrAndBreakdown(chunks.slice(0, orIndex)),
      recursiveOrAndBreakdown(chunks.slice(orIndex + 1)),
    );
  }

  if (andIndex !== -1) {
    return mergeAnd(
      recursiveOrAndBreakdown(chunks.slice(0, andIndex)),
      recursiveOrAndBreakdown(chunks.slice(andIndex + 1)),
    );
  }

  if (chunks[0] === "(" && chunks[chunks.length - 1] === ")") {
    return recursiveOrAndBreakdown(chunks.slice(1, -1));
  }

  return [chunks];
}

const data = require("./prerequisites-1784270712.json");
// const testing = data.courses.map((c) => c.prerequisites);

for (const course of data.courses) {
  console.log(course.course);
  console.dir(extractPrereqs(course.prerequisites), { depth: null });
  console.log(course.prerequisites + "\n\n");
}
