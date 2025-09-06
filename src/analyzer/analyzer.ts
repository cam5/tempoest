import { CstNode } from 'chevrotain';
import {
  Program,
  ParsedLine,
  AnalysisContext,
  TaskNode,
  DirectiveNode,
  CategoryPath,
  Diagnostic,
  LineStatus,
  ErrorCode,
  WarningCode,
  ParseOptions,
  ParsedLineRaw,
  RawTaskParts,
  RawDirectiveParts,
} from '../types';
import { parser } from '../parser/parser';
import { tokenize, TokenizeResult } from '../lexer/lexer';

export class DayPlanAnalyzer {
  private context: AnalysisContext;
  private cursorTime: Date | null = null;
  private tasks: TaskNode[] = []; // For overlap detection
  private currentSection: 'planner' | 'scratchpad' = 'planner'; // Default to planner

  constructor(options: ParseOptions = {}) {
    const today = options.today || new Date().toISOString().split('T')[0];
    const timezone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    this.context = {
      day: today,
      timezone,
      defaultDurationMin: 30,
      overlapPolicy: "warning",
    };
  }

  analyze(source: string): Program {
    const lines = source.split(/\r?\n/);
    const tokenizeResult = tokenize(source);
    
    // Parse the entire input
    parser.input = tokenizeResult.tokens;
    const cst = parser.program();
    
    // Convert to raw parsed lines
    const rawLines = this.parseLinesToRaw(lines, tokenizeResult, cst);
    
    // First pass: process all directives
    rawLines.forEach(rawLine => {
      if (rawLine.directive) {
        try {
          this.applyDirective(rawLine.directive);
        } catch (error) {
          // Errors will be handled in second pass
        }
      }
    });
    
    // Second pass: analyze each line
    const analyzedLines = rawLines.map((rawLine, index) => 
      this.analyzeLine(rawLine, index)
    );
    
    return {
      context: { ...this.context },
      lines: analyzedLines,
    };
  }

  private parseLinesToRaw(
    lines: string[], 
    tokenizeResult: TokenizeResult, 
    _cst: CstNode
  ): ParsedLineRaw[] {
    const rawLines: ParsedLineRaw[] = [];
    
    lines.forEach((line, index) => {
      const lineNo = index + 1;
      const preprocessResult = tokenizeResult.preprocessResults[index];
      
      const rawLine: ParsedLineRaw = {
        lineNo,
        raw: line,
        diagnostics: [...preprocessResult.diagnostics],
        hasSpaceAfterDash: preprocessResult.hasSpaceAfterDash,
        isBlank: line.trim() === '',
        isComment: /^\s*(#|\/\/)/.test(line),
      };
      
      // Parse the line content if it's not blank or comment-only
      if (!rawLine.isBlank && !rawLine.isComment && (line.trim().startsWith('-') || line.trim().startsWith('!'))) {
        try {
          const lineContent = this.parseLineContent(line, lineNo, this.currentSection);
          
          // Apply directive immediately to update current section
          if (lineContent.directive) {
            rawLine.directive = lineContent.directive;
            // Apply directive to update section state
            if (lineContent.directive.name === 'scratchpad' || lineContent.directive.name === 'planner') {
              this.applyDirective(lineContent.directive);
            }
          }
          
          // Handle parsed content
          if (lineContent.task) {
            rawLine.task = lineContent.task;
          } else if (!lineContent.directive && this.currentSection === 'scratchpad') {
            // Mark non-directive content in scratchpad as scratchpad
            rawLine.isScratchpad = true;
          }
          
          rawLine.diagnostics.push(...lineContent.diagnostics);
        } catch (error) {
          rawLine.diagnostics.push({
            code: 'E001-bad-time',
            message: `Parse error: ${error}`,
            span: { line: lineNo, startCol: 1, endCol: line.length + 1 },
          });
        }
      }
      
      rawLines.push(rawLine);
    });
    
    return rawLines;
  }

  private parseLineContent(line: string, lineNo: number, currentSection: 'planner' | 'scratchpad' = 'planner'): {
    task?: RawTaskParts;
    directive?: RawDirectiveParts;
    diagnostics: Diagnostic[];
  } {
    const diagnostics: Diagnostic[] = [];
    
    // Simple regex-based parsing for now (would be replaced with proper CST walking)
    let content: string;
    
    // Handle both dash-prefixed and bare directive formats
    const dashMatch = line.match(/^\s*-\s*(.*)$/);
    const directiveMatch = line.match(/^\s*!(.*)$/);
    
    if (dashMatch) {
      content = dashMatch[1];
    } else if (directiveMatch) {
      content = '!' + directiveMatch[1];
    } else {
      return { diagnostics };
    }
    
    // Check for directive
    if (content.startsWith('!')) {
      const directiveMatch = content.match(/^!(\w+)\s*(.*)/);
      if (directiveMatch) {
        const [, name, argsStr] = directiveMatch;
        const args: Record<string, string> = {};
        
        // Handle section directives (scratchpad, planner)
        if (name === 'scratchpad' || name === 'planner') {
          return {
            directive: { name, args: {} },
            diagnostics,
          };
        }
        
        // Parse key=value pairs and standalone values for other directives
        if (argsStr.trim()) {
          const keyValueMatches = argsStr.matchAll(/(\w+)=([^\s,]+)/g);
          for (const match of keyValueMatches) {
            args[match[1]] = match[2];
          }
          
          // If no key=value pairs found, treat the whole thing as a single value
          if (Object.keys(args).length === 0) {
            // For directives like "!day 2025-09-03", use the directive name as key
            args[name] = argsStr.trim();
          }
        }
        
        return {
          directive: { name, args },
          diagnostics,
        };
      }
    }
    
    // Don't parse as task if we're in scratchpad section
    if (currentSection === 'scratchpad') {
      return { diagnostics };
    }
    
    // Parse as task
    const task: RawTaskParts = {
      categories: [],
      titleParts: [],
    };
    
    // Split by commas and spaces, but preserve categories
    const parts = this.splitTaskParts(content);
    
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;
      
      // Check for time patterns
      if (this.isTimePart(trimmedPart)) {
        if (task.time) {
          diagnostics.push({
            code: WarningCode.UNKNOWN_PART,
            message: 'Multiple time values found',
            span: { line: lineNo, startCol: 1, endCol: line.length + 1 },
          });
        } else {
          task.time = trimmedPart;
        }
      }
      // Check for duration patterns
      else if (this.isDurationPart(trimmedPart)) {
        if (task.duration) {
          diagnostics.push({
            code: WarningCode.UNKNOWN_PART,
            message: 'Multiple duration values found',
            span: { line: lineNo, startCol: 1, endCol: line.length + 1 },
          });
        } else {
          task.duration = trimmedPart;
        }
      }
      // Check for category patterns
      else if (this.isCategoryPart(trimmedPart)) {
        const categoryResult = this.parseCategory(trimmedPart, lineNo);
        if (categoryResult.error) {
          diagnostics.push(categoryResult.error);
        } else if (categoryResult.category) {
          task.categories.push(categoryResult.category);
        }
      }
      // Check for likely invalid category patterns
      else if (this.isLikelyBadCategory(trimmedPart)) {
        diagnostics.push({
          code: ErrorCode.BAD_CATEGORY,
          message: `Invalid category format: ${trimmedPart}`,
          span: { line: lineNo, startCol: 1, endCol: line.length + 1 },
        });
        // Still add to title to avoid losing data
        task.titleParts.push(trimmedPart);
      }
      // Check for likely invalid duration patterns
      else if (this.isLikelyBadDuration(trimmedPart)) {
        diagnostics.push({
          code: ErrorCode.BAD_DURATION,
          message: `Invalid duration format: ${trimmedPart}`,
          span: { line: lineNo, startCol: 1, endCol: line.length + 1 },
        });
        // Still add to title to avoid losing data
        task.titleParts.push(trimmedPart);
      }
      // Everything else is title
      else {
        task.titleParts.push(trimmedPart);
      }
    }
    
    // Check for trailing comma - look for comma at end of parts or before comment
    const beforeComment = content.split(/\s*[#\/]/)[0]; // Split at comment markers
    if (beforeComment.trim().endsWith(',')) {
      diagnostics.push({
        code: WarningCode.TRAILING_COMMA,
        message: 'Trailing comma found',
        span: { line: lineNo, startCol: beforeComment.lastIndexOf(',') + 1, endCol: beforeComment.lastIndexOf(',') + 2 },
      });
    }
    
    return { task, diagnostics };
  }

  private splitTaskParts(content: string): string[] {
    // Simple split that respects categories
    const parts: string[] = [];
    let current = '';
    let inCategory = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];
      
      if (char === ':') {
        inCategory = true;
        current += char;
      } else if (char === ',' && !inCategory) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = '';
      } else if (char === ' ' && !inCategory && current.trim()) {
        // Space separator when not in category
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
        if (inCategory && char !== ':' && nextChar !== ':') {
          inCategory = false;
        }
      }
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  private isTimePart(part: string): boolean {
    return /^(?:\d{1,2}(?::\d{2})?(?:am|pm)?|\d{2}:\d{2}|noon|midnight)$/i.test(part);
  }

  private isDurationPart(part: string): boolean {
    return /^\d+h(?:\d{1,2}m)?|\d+m$/.test(part);
  }

  private isCategoryPart(part: string): boolean {
    return /^:[a-zA-Z0-9_-]+(?:::[a-zA-Z0-9_-]+)*$/.test(part);
  }

  private isLikelyBadDuration(part: string): boolean {
    // Check for patterns that look like durations but are invalid
    return /^\d+[a-zA-Z]$/.test(part) && !this.isDurationPart(part);
  }

  private isLikelyBadCategory(part: string): boolean {
    // Check for patterns that look like categories but are invalid
    return part.startsWith(':') && !this.isCategoryPart(part);
  }

  private parseCategory(part: string, lineNo: number): {
    category?: string;
    error?: Diagnostic;
  } {
    if (part.endsWith('::') || part.includes(':::')) {
      return {
        error: {
          code: ErrorCode.BAD_CATEGORY,
          message: 'Invalid category format',
          span: { line: lineNo, startCol: 1, endCol: part.length + 1 },
        },
      };
    }
    
    return { category: part };
  }

  private analyzeLine(rawLine: ParsedLineRaw, index: number): ParsedLine {
    const id = this.generateLineId(rawLine.raw, index);
    
    if (rawLine.isBlank || rawLine.isComment) {
      return {
        id,
        raw: rawLine.raw,
        lineNo: rawLine.lineNo,
        status: "valid",
        diagnostics: rawLine.diagnostics,
        node: null,
      };
    }
    
    if (rawLine.directive) {
      return this.analyzeDirective(rawLine, id);
    }
    
    if (rawLine.task) {
      return this.analyzeTask(rawLine, id);
    }
    
    // Handle scratchpad lines - they're valid but not parsed as tasks
    if (rawLine.isScratchpad) {
      return {
        id,
        raw: rawLine.raw,
        lineNo: rawLine.lineNo,
        status: "valid",
        diagnostics: rawLine.diagnostics,
        node: null,
      };
    }
    
    return {
      id,
      raw: rawLine.raw,
      lineNo: rawLine.lineNo,
      status: "valid",
      diagnostics: rawLine.diagnostics,
      node: null,
    };
  }

  private analyzeDirective(rawLine: ParsedLineRaw, id: string): ParsedLine {
    const directive = rawLine.directive!;
    const diagnostics = [...rawLine.diagnostics];
    
    // Apply directive to context
    try {
      this.applyDirective(directive);
    } catch (error) {
      diagnostics.push({
        code: ErrorCode.UNKNOWN_DIRECTIVE,
        message: `${error}`,
        span: { line: rawLine.lineNo, startCol: 1, endCol: rawLine.raw.length + 1 },
      });
    }
    
    const node: DirectiveNode = {
      kind: "directive",
      name: directive.name as any,
      args: directive.args,
    };
    
    const status: LineStatus = diagnostics.some(d => d.code.startsWith('E')) ? "invalid" : 
                              diagnostics.length > 0 ? "valid-with-warnings" : "valid";
    
    return {
      id,
      raw: rawLine.raw,
      lineNo: rawLine.lineNo,
      status,
      diagnostics,
      node,
    };
  }

  private analyzeTask(rawLine: ParsedLineRaw, id: string): ParsedLine {
    const task = rawLine.task!;
    const diagnostics = [...rawLine.diagnostics];
    
    // Parse and validate components
    const parsedTime = task.time ? this.parseTime(task.time, rawLine.lineNo) : null;
    const parsedDuration = task.duration ? this.parseDuration(task.duration, rawLine.lineNo) : null;
    const parsedCategories = this.parseCategories(task.categories, rawLine.lineNo);
    
    // Collect parsing errors
    if (parsedTime?.error) diagnostics.push(parsedTime.error);
    if (parsedDuration?.error) diagnostics.push(parsedDuration.error);
    parsedCategories.errors.forEach(err => diagnostics.push(err));
    
    // Determine start time
    let start: Date | null = null;
    let explicitStart = false;
    
    if (parsedTime?.value) {
      start = this.resolveTimeToDate(parsedTime.value);
      explicitStart = true;
    } else if (this.cursorTime) {
      start = new Date(this.cursorTime);
      explicitStart = false;
    } else {
      diagnostics.push({
        code: ErrorCode.MISSING_START_FIRST_LINE,
        message: 'First task must have an explicit start time',
        span: { line: rawLine.lineNo, startCol: 1, endCol: rawLine.raw.length + 1 },
      });
    }
    
    // Determine duration
    const durationMin = parsedDuration?.value ?? this.context.defaultDurationMin;
    const explicitDuration = parsedDuration?.value !== undefined;
    
    // Calculate end time
    let end: Date | null = null;
    if (start) {
      end = new Date(start.getTime() + durationMin * 60 * 1000);
    }
    
    // Check for overlaps
    if (start && end && this.context.overlapPolicy !== 'ignore') {
      const overlap = this.checkOverlap(start, end);
      if (overlap) {
        const diagnostic: Diagnostic = {
          code: this.context.overlapPolicy === 'error' ? ErrorCode.OVERLAP : WarningCode.OVERLAP,
          message: `Task overlaps with previous task`,
          span: { line: rawLine.lineNo, startCol: 1, endCol: rawLine.raw.length + 1 },
        };
        diagnostics.push(diagnostic);
      }
    }
    
    // Build the task node
    const taskNode: TaskNode = {
      kind: "task",
      title: task.titleParts.join(' ').trim() || 'Untitled',
      start: start?.toISOString(),
      durationMin,
      end: end?.toISOString(),
      categories: parsedCategories.categories,
      explicitStart,
      explicitDuration,
    };
    
    // Update cursor if this task is valid
    const hasErrors = diagnostics.some(d => d.code.startsWith('E'));
    if (!hasErrors && end) {
      this.cursorTime = end;
      this.tasks.push(taskNode);
    }
    
    const status: LineStatus = hasErrors ? "invalid" : 
                              diagnostics.length > 0 ? "valid-with-warnings" : "valid";
    
    return {
      id,
      raw: rawLine.raw,
      lineNo: rawLine.lineNo,
      status,
      diagnostics,
      node: taskNode,
    };
  }

  private parseTime(timeStr: string, lineNo: number): { value?: Date; error?: Diagnostic } {
    try {
      // Simple time parsing - would be more robust in production
      let hours = 0;
      let minutes = 0;
      
      if (timeStr.toLowerCase() === 'noon') {
        hours = 12;
      } else if (timeStr.toLowerCase() === 'midnight') {
        hours = 0;
      } else {
        const timeMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?(?:(am|pm))?$/i);
        if (!timeMatch) {
          throw new Error('Invalid time format');
        }
        
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2] || '0', 10);
        const ampm = timeMatch[3]?.toLowerCase();
        
        if (ampm === 'pm' && hours !== 12) {
          hours += 12;
        } else if (ampm === 'am' && hours === 12) {
          hours = 0;
        }
      }
      
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      
      return { value: date };
    } catch (error) {
      return {
        error: {
          code: ErrorCode.BAD_TIME,
          message: `Invalid time format: ${timeStr}`,
          span: { line: lineNo, startCol: 1, endCol: timeStr.length + 1 },
        },
      };
    }
  }

  private parseDuration(durationStr: string, lineNo: number): { value?: number; error?: Diagnostic } {
    try {
      const match = durationStr.match(/^(?:(\d+)h)?(?:(\d+)m)?$/);
      if (!match) {
        throw new Error('Invalid duration format');
      }
      
      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2] || '0', 10);
      
      return { value: hours * 60 + minutes };
    } catch (error) {
      return {
        error: {
          code: ErrorCode.BAD_DURATION,
          message: `Invalid duration format: ${durationStr}`,
          span: { line: lineNo, startCol: 1, endCol: durationStr.length + 1 },
        },
      };
    }
  }

  private parseCategories(categories: string[], lineNo: number): {
    categories: CategoryPath[];
    errors: Diagnostic[];
  } {
    const result: CategoryPath[] = [];
    const errors: Diagnostic[] = [];
    
    for (const category of categories) {
      if (category.startsWith(':')) {
        const segments = category.slice(1).split('::');
        if (segments.some(s => !s.trim())) {
          errors.push({
            code: ErrorCode.BAD_CATEGORY,
            message: 'Empty category segment',
            span: { line: lineNo, startCol: 1, endCol: category.length + 1 },
          });
        } else {
          result.push({ segments });
        }
      }
    }
    
    return { categories: result, errors };
  }

  private applyDirective(directive: RawDirectiveParts): void {
    switch (directive.name) {
      case 'scratchpad':
        this.currentSection = 'scratchpad';
        break;
      case 'planner':
        this.currentSection = 'planner';
        break;
      case 'default':
        if (directive.args.duration) {
          const parsed = this.parseDuration(directive.args.duration, 1);
          if (parsed.value) {
            this.context.defaultDurationMin = parsed.value;
          } else {
            throw new Error('Invalid default duration');
          }
        }
        break;
      case 'policy':
        if (directive.args.overlaps) {
          const policy = directive.args.overlaps;
          if (['warning', 'error', 'ignore'].includes(policy)) {
            this.context.overlapPolicy = policy as any;
          } else {
            throw new Error('Invalid overlap policy');
          }
        }
        break;
      case 'day':
        // Validate YYYY-MM-DD format
        const dayMatch = Object.values(directive.args)[0]?.match(/^\d{4}-\d{2}-\d{2}$/);
        if (dayMatch) {
          this.context.day = Object.values(directive.args)[0];
        } else {
          throw new Error('Invalid day format, expected YYYY-MM-DD');
        }
        break;
      case 'tz':
        this.context.timezone = Object.values(directive.args)[0];
        break;
      default:
        throw new Error(`Unknown directive: ${directive.name}`);
    }
  }

  private resolveTimeToDate(time: Date): Date {
    // For now, just use today's date with the parsed time
    const today = this.context.day ? new Date(this.context.day + 'T00:00:00') : new Date();
    today.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return today;
  }

  private checkOverlap(start: Date, end: Date): boolean {
    return this.tasks.some(task => {
      if (!task.start || !task.end) return false;
      const taskStart = new Date(task.start);
      const taskEnd = new Date(task.end);
      return start < taskEnd && end > taskStart;
    });
  }

  private generateLineId(raw: string, index: number): string {
    // Simple hash-like ID generation
    const hash = raw.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
    }, 0);
    return `line_${index}_${Math.abs(hash).toString(16)}`;
  }
}
