// Core types for the day-planning DSL

export type LineStatus = "valid" | "valid-with-warnings" | "invalid";

export interface Diagnostic {
  code: string;
  message: string;
  span?: { line: number; startCol: number; endCol: number };
}

export interface CategoryPath {
  segments: string[]; // e.g., ["work", "planning"]
}

export interface TaskNode {
  kind: "task";
  title: string;                 // normalized
  start?: string;                // ISO with offset once analyzed
  durationMin?: number;          // minutes
  end?: string;                  // ISO with offset once analyzed
  categories: CategoryPath[];    // 0..n
  explicitStart: boolean;        // true if source had a Time
  explicitDuration: boolean;     // true if source had a Duration
}

export interface DirectiveNode {
  kind: "directive";
  name: "default" | "policy" | "day" | "tz" | "scratchpad" | "planner";
  args: Record<string, string>;
}

export interface ParsedLine {
  id: string;         // stable id, e.g., hash of raw+index
  raw: string;        // original text for round-tripping
  lineNo: number;     // 1-based
  status: LineStatus;
  diagnostics: Diagnostic[];
  node: TaskNode | DirectiveNode | null;  // null for blank/comment-only
}

export interface AnalysisContext {
  day?: string;                 // YYYY-MM-DD
  timezone?: string;            // IANA
  defaultDurationMin: number;   // default 30
  overlapPolicy: "warning" | "error" | "ignore";
}

export interface Program {
  context: AnalysisContext;
  lines: ParsedLine[];
}

// Parse options
export interface ParseOptions {
  today?: string;     // YYYY-MM-DD, defaults to current date
  timezone?: string;  // IANA timezone, defaults to system timezone
}

// Error codes enum for exhaustive checking
export enum ErrorCode {
  BAD_TIME = "E001-bad-time",
  BAD_DURATION = "E010-bad-duration",
  MISSING_START_FIRST_LINE = "E020-missing-start-first-line",
  OVERLAP = "E030-overlap",
  UNKNOWN_DIRECTIVE = "E040-unknown-directive",
  BAD_CATEGORY = "E050-bad-category",
}

export enum WarningCode {
  MISSING_SPACE_AFTER_DASH = "W001-missing-space-after-dash",
  TRAILING_COMMA = "W005-trailing-comma",
  OVERLAP = "W010-overlap",
  AMBIGUOUS_TIME = "W020-ambiguous-time",
  UNKNOWN_PART = "W030-unknown-part",
}

// Internal AST types (before analysis)
export interface RawTaskParts {
  time?: string;
  duration?: string;
  categories: string[];
  titleParts: string[];
}

export interface RawDirectiveParts {
  name: string;
  args: Record<string, string>;
}

export interface ParsedLineRaw {
  lineNo: number;
  raw: string;
  diagnostics: Diagnostic[];
  hasSpaceAfterDash: boolean;
  isBlank: boolean;
  isComment: boolean;
  isScratchpad?: boolean;  // true if line is in scratchpad section
  task?: RawTaskParts;
  directive?: RawDirectiveParts;
}
