import { createToken, Lexer } from 'chevrotain';

// Define tokens for the day-planning DSL

// Whitespace - we need to be careful with spaces after dash
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /[ \t]+/,
  group: Lexer.SKIPPED,
});

// Line terminators
export const EOL = createToken({
  name: 'EOL',
  pattern: /\r?\n/,
});

// Structural tokens
export const Dash = createToken({
  name: 'Dash',
  pattern: /-/,
});

export const Bang = createToken({
  name: 'Bang',
  pattern: /!/,
});

export const Comma = createToken({
  name: 'Comma',
  pattern: /,/,
});

export const Equals = createToken({
  name: 'Equals',
  pattern: /=/,
});

// Comments
export const HashComment = createToken({
  name: 'HashComment',
  pattern: /#[^\r\n]*/,
});

export const SlashComment = createToken({
  name: 'SlashComment',
  pattern: /\/\/[^\r\n]*/,
});

// Time patterns (order matters - more specific first)
export const TimeWord = createToken({
  name: 'TimeWord',
  pattern: /(?:noon|midnight)/i,
});

// Duration patterns (must come before TimeClock to avoid conflicts)
export const Duration = createToken({
  name: 'Duration',
  pattern: /\d+h(?:\d{1,2}m)?|\d+m/,
});

export const TimeClock = createToken({
  name: 'TimeClock',
  pattern: /(?:\d{1,2}(?::\d{2})?(?:am|pm)?|\d{2}:\d{2})/i,
});

// Category tokens
export const CategoryColon = createToken({
  name: 'CategoryColon',
  pattern: /:/,
});

export const CategoryDouble = createToken({
  name: 'CategoryDouble',
  pattern: /::/,
});

// Identifiers and text
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[A-Za-z0-9_-]+/,
});

// Section directive keywords (must come before Identifier in allTokens)
export const ScratchpadDirective = createToken({
  name: 'ScratchpadDirective',
  pattern: /scratchpad/,
  longer_alt: Identifier,
});

export const PlannerDirective = createToken({
  name: 'PlannerDirective',
  pattern: /planner/,
  longer_alt: Identifier,
});

// Generic text for title parts and other content
export const Text = createToken({
  name: 'Text',
  pattern: /[^\s,:#\r\n]+/,
});

// All tokens in order of precedence (more specific patterns first)
export const allTokens = [
  WhiteSpace,
  EOL,
  
  // Comments (before other patterns that might match)
  HashComment,
  SlashComment,
  
  // Structural
  Dash,
  Bang,
  Comma,
  Equals,
  
  // Categories (:: before :)
  CategoryDouble,
  CategoryColon,
  
  // Time and duration (duration before TimeClock to avoid conflicts)
  TimeWord,
  Duration,
  TimeClock,
  
  // Section directives (before Identifier to match first)
  ScratchpadDirective,
  PlannerDirective,
  
  // Identifiers and text
  Identifier,
  Text,
];

// Pre-process function to handle dash-space detection per line
export interface LinePreprocessResult {
  hasSpaceAfterDash: boolean;
  processedLine: string;
  diagnostics: Array<{
    code: string;
    message: string;
    span: { line: number; startCol: number; endCol: number };
  }>;
}

export function preprocessLine(line: string, lineNo: number): LinePreprocessResult {
  const diagnostics: LinePreprocessResult['diagnostics'] = [];
  
  // Check for dash pattern at start of line
  const dashMatch = line.match(/^(\s*-\s*)/);
  if (!dashMatch) {
    // Not a dash line, return as-is
    return {
      hasSpaceAfterDash: true, // N/A for non-dash lines
      processedLine: line,
      diagnostics,
    };
  }
  
  const dashPart = dashMatch[1];
  const afterDash = line.slice(dashPart.length);
  
  // Check if there's a space after the dash
  const hasSpaceAfterDash = /^-\s+/.test(dashPart);
  
  if (!hasSpaceAfterDash && afterDash.length > 0 && !/^\s/.test(afterDash)) {
    // Missing space after dash
    diagnostics.push({
      code: 'W001-missing-space-after-dash',
      message: 'Missing space after dash',
      span: {
        line: lineNo,
        startCol: dashPart.length,
        endCol: dashPart.length + 1,
      },
    });
    
    // Inject a virtual space for parsing
    const processedLine = dashPart + ' ' + afterDash;
    return {
      hasSpaceAfterDash: false,
      processedLine,
      diagnostics,
    };
  }
  
  return {
    hasSpaceAfterDash: true,
    processedLine: line,
    diagnostics,
  };
}