/**
 * Core LSP functionality without external dependencies
 * This provides the essential time shifting and analysis features
 * that UI projects can use directly with Monaco or other editors
 */

import { parseAndAnalyze } from '../index';
import { ParsedLine, TaskNode, Diagnostic, Program } from '../types';
import { executeTimeShift, executeBatchTimeShift } from './commands/time-shift';
import { parseTimeOffset, validateTimeOffset, type TimeOffset } from './time-utils';

export interface TempoestLanguageService {
  // Document analysis
  analyzeDocument(content: string): Program;
  
  // Time manipulation
  shiftTime(content: string, lineNumber: number, offset: string): TimeShiftResult;
  shiftMultipleLines(content: string, lineNumbers: number[], offset: string): BatchTimeShiftResult;
  
  // Completions and hover
  getCompletions(content: string, lineNumber: number, column: number): CompletionItem[];
  getHover(content: string, lineNumber: number, column: number): HoverInfo | null;
  
  // Diagnostics
  getDiagnostics(content: string): DiagnosticInfo[];
  
  // Code actions
  getCodeActions(content: string, lineNumber: number): CodeAction[];
}

export interface TimeShiftResult {
  success: boolean;
  newContent?: string;
  error?: string;
  affectedLines?: number[];
}

export interface BatchTimeShiftResult {
  success: boolean;
  newContent?: string;
  error?: string;
  results: Map<number, { success: boolean; error?: string }>;
}

export interface CompletionItem {
  label: string;
  kind: 'time' | 'duration' | 'category' | 'keyword';
  detail?: string;
  insertText: string;
}

export interface HoverInfo {
  title: string;
  details: string[];
}

export interface DiagnosticInfo {
  line: number;
  startColumn: number;
  endColumn: number;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface CodeAction {
  title: string;
  kind: 'quickfix' | 'refactor';
  edit?: TextEdit;
  command?: { id: string; args: any[] };
}

export interface TextEdit {
  line: number;
  startColumn: number;
  endColumn: number;
  newText: string;
}

/**
 * Create a Tempoest language service instance
 */
export function createTempoestLanguageService(): TempoestLanguageService {
  return new TempoestLanguageServiceImpl();
}

class TempoestLanguageServiceImpl implements TempoestLanguageService {
  
  analyzeDocument(content: string): Program {
    return parseAndAnalyze(content);
  }
  
  shiftTime(content: string, lineNumber: number, offset: string): TimeShiftResult {
    const validation = validateTimeOffset(offset);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const program = this.analyzeDocument(content);
    const line = program.lines[lineNumber - 1]; // Convert to 0-based
    
    if (!line) {
      return { success: false, error: 'Line not found' };
    }
    
    const shiftResult = executeTimeShift(line, offset, program.lines);
    if (!shiftResult.success) {
      return { success: false, error: shiftResult.error };
    }
    
    // Reconstruct the full document with the changed line
    const lines = content.split(/\r?\n/);
    lines[lineNumber - 1] = shiftResult.newLineContent!;
    
    return {
      success: true,
      newContent: lines.join('\n'),
      affectedLines: shiftResult.affectedLines?.map(id => {
        // Convert line IDs back to line numbers
        const affectedLine = program.lines.find(l => l.id === id);
        return affectedLine ? affectedLine.lineNo : -1;
      }).filter(n => n > 0)
    };
  }
  
  shiftMultipleLines(content: string, lineNumbers: number[], offset: string): BatchTimeShiftResult {
    const validation = validateTimeOffset(offset);
    if (!validation.valid) {
      return { 
        success: false, 
        error: validation.error,
        results: new Map()
      };
    }
    
    const program = this.analyzeDocument(content);
    const lines = lineNumbers.map(n => program.lines[n - 1]).filter(Boolean);
    
    const batchResult = executeBatchTimeShift(lines, offset);
    
    if (!batchResult.success) {
      return {
        success: false,
        error: batchResult.error,
        results: new Map()
      };
    }
    
    // Apply all changes to content
    const contentLines = content.split(/\r?\n/);
    const results = new Map<number, { success: boolean; error?: string }>();
    
    for (const [lineId, result] of batchResult.results) {
      const line = program.lines.find(l => l.id === lineId);
      if (line && result.success && result.newLineContent) {
        contentLines[line.lineNo - 1] = result.newLineContent;
        results.set(line.lineNo, { success: true });
      } else if (line) {
        results.set(line.lineNo, { success: false, error: result.error });
      }
    }
    
    return {
      success: true,
      newContent: contentLines.join('\n'),
      results
    };
  }
  
  getCompletions(content: string, lineNumber: number, column: number): CompletionItem[] {
    const lines = content.split(/\r?\n/);
    const line = lines[lineNumber - 1] || '';
    const beforeCursor = line.substring(0, column);
    
    const completions: CompletionItem[] = [];
    
    // Time completions
    if (line.includes('-') && !line.match(/\d{1,2}(?::\d{2})?(?:am|pm)/i)) {
      completions.push(
        { label: '9am', kind: 'time', detail: 'Morning time', insertText: '9am' },
        { label: '10:30am', kind: 'time', detail: 'Specific time', insertText: '10:30am' },
        { label: '2pm', kind: 'time', detail: 'Afternoon time', insertText: '2pm' },
        { label: 'noon', kind: 'time', detail: '12:00 PM', insertText: 'noon' },
        { label: 'midnight', kind: 'time', detail: '12:00 AM', insertText: 'midnight' }
      );
    }
    
    // Duration completions
    if (beforeCursor.includes(',') || beforeCursor.includes(' ')) {
      completions.push(
        { label: '15m', kind: 'duration', detail: '15 minutes', insertText: '15m' },
        { label: '30m', kind: 'duration', detail: '30 minutes', insertText: '30m' },
        { label: '45m', kind: 'duration', detail: '45 minutes', insertText: '45m' },
        { label: '1h', kind: 'duration', detail: '1 hour', insertText: '1h' },
        { label: '1h30m', kind: 'duration', detail: '1 hour 30 minutes', insertText: '1h30m' },
        { label: '2h', kind: 'duration', detail: '2 hours', insertText: '2h' }
      );
    }
    
    // Category completions
    if (beforeCursor.includes(':') || line.includes(':')) {
      completions.push(
        { label: ':work', kind: 'category', detail: 'Work category', insertText: ':work' },
        { label: ':work::meeting', kind: 'category', detail: 'Work meeting', insertText: ':work::meeting' },
        { label: ':work::focus', kind: 'category', detail: 'Focused work', insertText: ':work::focus' },
        { label: ':personal', kind: 'category', detail: 'Personal category', insertText: ':personal' },
        { label: ':home', kind: 'category', detail: 'Home category', insertText: ':home' },
        { label: ':home::cleaning', kind: 'category', detail: 'Home cleaning', insertText: ':home::cleaning' }
      );
    }
    
    return completions;
  }
  
  getHover(content: string, lineNumber: number, column: number): HoverInfo | null {
    const program = this.analyzeDocument(content);
    const line = program.lines[lineNumber - 1];
    
    if (!line || line.node?.kind !== 'task') return null;
    
    const task = line.node as TaskNode;
    const details: string[] = [];
    
    if (task.start && task.end) {
      const start = new Date(task.start).toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit', hour12: true 
      });
      const end = new Date(task.end).toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit', hour12: true 
      });
      details.push(`⏰ ${start} - ${end} (${task.durationMin}m)`);
    }
    
    if (task.categories.length > 0) {
      const categoryStrs = task.categories.map(c => c.segments.join('::'));
      details.push(`🏷️ ${categoryStrs.join(', ')}`);
    }
    
    details.push(`📍 Start: ${task.explicitStart ? 'Explicit' : 'Inferred'}`);
    details.push(`⏱️ Duration: ${task.explicitDuration ? 'Explicit' : 'Default'}`);
    
    return {
      title: task.title,
      details
    };
  }
  
  getDiagnostics(content: string): DiagnosticInfo[] {
    const program = this.analyzeDocument(content);
    const diagnostics: DiagnosticInfo[] = [];
    
    for (const line of program.lines) {
      for (const diag of line.diagnostics) {
        diagnostics.push({
          line: line.lineNo,
          startColumn: diag.span?.startCol || 1,
          endColumn: diag.span?.endCol || line.raw.length + 1,
          message: diag.message,
          code: diag.code,
          severity: diag.code.startsWith('E') ? 'error' : 'warning'
        });
      }
    }
    
    return diagnostics;
  }
  
  getCodeActions(content: string, lineNumber: number): CodeAction[] {
    const program = this.analyzeDocument(content);
    const line = program.lines[lineNumber - 1];
    
    if (!line) return [];
    
    const actions: CodeAction[] = [];
    
    // Time shifting actions for task lines
    if (line.node?.kind === 'task') {
      actions.push(
        {
          title: '⏩ Shift forward 15 minutes',
          kind: 'refactor',
          command: { id: 'tempoest.shiftTime', args: [lineNumber, '+15m'] }
        },
        {
          title: '⏪ Shift backward 15 minutes', 
          kind: 'refactor',
          command: { id: 'tempoest.shiftTime', args: [lineNumber, '-15m'] }
        },
        {
          title: '⏩ Shift forward 30 minutes',
          kind: 'refactor',
          command: { id: 'tempoest.shiftTime', args: [lineNumber, '+30m'] }
        },
        {
          title: '⏪ Shift backward 30 minutes',
          kind: 'refactor',
          command: { id: 'tempoest.shiftTime', args: [lineNumber, '-30m'] }
        }
      );
    }
    
    // Quick fixes for diagnostics
    for (const diagnostic of line.diagnostics) {
      if (diagnostic.code === 'W001-missing-space-after-dash') {
        actions.push({
          title: 'Add space after dash',
          kind: 'quickfix',
          edit: {
            line: lineNumber,
            startColumn: 2,
            endColumn: 2,
            newText: ' '
          }
        });
      }
      
      if (diagnostic.code === 'W005-trailing-comma') {
        const commaIndex = line.raw.lastIndexOf(',');
        if (commaIndex !== -1) {
          actions.push({
            title: 'Remove trailing comma',
            kind: 'quickfix',
            edit: {
              line: lineNumber,
              startColumn: commaIndex + 1,
              endColumn: commaIndex + 2,
              newText: ''
            }
          });
        }
      }
    }
    
    return actions;
  }
}

/**
 * Utility functions for UI integration
 */
export const TempoestUtils = {
  parseTimeOffset,
  validateTimeOffset,
  
  /**
   * Quick time shift without full document analysis
   */
  quickShiftTime(lineContent: string, offset: string): { success: boolean; newLine?: string; error?: string } {
    const validation = validateTimeOffset(offset);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Create a minimal document for analysis
    const tempDoc = lineContent;
    const program = parseAndAnalyze(tempDoc);
    
    if (program.lines.length === 0 || program.lines[0].node?.kind !== 'task') {
      return { success: false, error: 'Not a valid task line' };
    }
    
    const result = executeTimeShift(program.lines[0], offset);
    
    return {
      success: result.success,
      newLine: result.newLineContent,
      error: result.error
    };
  },
  
  /**
   * Get suggested time offsets for UI buttons
   */
  getCommonOffsets(): Array<{ label: string; offset: string; icon: string }> {
    return [
      { label: '15m earlier', offset: '-15m', icon: '⏪' },
      { label: '15m later', offset: '+15m', icon: '⏩' },
      { label: '30m earlier', offset: '-30m', icon: '⏪⏪' },
      { label: '30m later', offset: '+30m', icon: '⏩⏩' },
      { label: '1h earlier', offset: '-1h', icon: '⏪⏪⏪' },
      { label: '1h later', offset: '+1h', icon: '⏩⏩⏩' }
    ];
  }
};
