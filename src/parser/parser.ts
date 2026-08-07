import type { SyntaxToken } from "./tokens.ts";

type Requirement =
  | { kind: "course"; code: string }
  | { kind: "allOf"; items: Requirement[] }
  | { kind: "anyOf"; items: Requirement[] };

function group(kind: "allOf" | "anyOf", items: Requirement[]): Requirement {
  if (items.length === 1) {
    const onlyItem = items[0];

    if (onlyItem) {
      return onlyItem;
    }
  }

  return { kind, items };
}

/**
 * Class that handles parsing the normalized tokens.
 * `and` has lower precendence than `or`.
 */
export class RequirementParser {
  private position = 0;
  private readonly tokens: SyntaxToken[];

  constructor(tokens: SyntaxToken[]) {
    this.tokens = tokens;
  }

  parse(): Requirement | undefined {
    if (this.isAtEnd()) {
      return undefined;
    }

    const requirement = this._parse();

    if (!this.isAtEnd()) {
      throw new Error(
        `Unexpected token ${this.currentTokenString()} at ${this.position}`,
      );
    }

    return requirement;
  }

  /**
   * Creates an `and` grouping.
   * @returns group marked "allOf"
   */
  private parseAllOf(): Requirement {
    const reqs: Requirement[] = [this.parseAnyOf()];

    while (this.tokenIs("and")) {
      reqs.push(this.parseAnyOf());
    }

    return group("allOf", reqs);
  }

  /**
   * Creates an `or` grouping.
   * @returns group marked "anyOf"
   */
  private parseAnyOf(): Requirement {
    const reqs: Requirement[] = [this.parseTokens()];

    while (this.tokenIs("or")) {
      reqs.push(this.parseTokens());
    }

    return group("anyOf", reqs);
  }

  /**
   * The actual parsing function.
   *
   * @returns the requirement parsed
   */
  private parseTokens(): Requirement {
    const token = this.currentToken();

    if (!token || (token.kind !== "course" && token.kind !== "lparen")) {
      throw new Error(
        `Expected a course or lparen, found ${this.currentTokenString()} at ${this.position}`,
      );
    }

    if (token.kind === "course") {
      this.position++;

      return token;
    }

    if (this.tokenIs("lparen")) {
      const requirement = this.parseAllOf();
      this.consumeRParen();
      return requirement;
    }

    throw new Error(
      `Expected a course or lparen, found ${this.currentTokenString()} at ${this.position}`,
    );
  }

  private tokenIs(kind: SyntaxToken["kind"]): boolean {
    if (this.currentToken()?.kind !== kind) {
      return false;
    }

    this.position++;
    return true;
  }

  /**
   * Parses prerequisites that may use a semicolon to denote an `or` with the left and right side.
   *
   * e.g. MACM 442: (CMPT 201 or 225) and one of (MATH 340 or 332 or 342); or CMPT 405.
   * Since we bind `or` more tightly, the `or` gets mixed with the MATH requirements.
   */
  private _parse(): Requirement {
    const reqs: Requirement[] = [this.parseAllOf()];

    while (this.tokenIs("semicolon")) {
      if (!this.tokenIs("or")) {
        throw new Error("Expected 'or' after semicolon");
      }
      reqs.push(this.parseAllOf());
    }

    return group("anyOf", reqs);
  }

  private consumeRParen(): void {
    if (!this.tokenIs("rparen")) {
      throw new Error(`Expected rparen, found ${this.currentTokenString()}`);
    }
  }

  private currentToken(): SyntaxToken | undefined {
    return this.tokens[this.position] ?? undefined;
  }

  private isAtEnd(): boolean {
    return this.position >= this.tokens.length;
  }

  private currentTokenString(): string {
    return this.currentToken()?.kind ?? "end of input";
  }
}
