export type Token =
  | { kind: "course" | "number"; value: string; start: number; end: number }
  | {
      kind:
        "and" | "or" | "comma" | "lparen" | "rparen" | "semicolon" | "period";
      start: number;
      end: number;
    }
  | { kind: "text"; value: string; start: number; end: number };

export type SyntaxToken =
  | { kind: "course"; code: string }
  | { kind: "and" | "or" | "comma" | "semicolon" | "lparen" | "rparen" };
