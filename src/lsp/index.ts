/**
 * Language service exports for Tempoest DSL
 * 
 * This provides core time manipulation and language analysis features
 * that UI projects can integrate without heavy dependencies.
 */

// Core language service (main API)
export {
  createTempoestLanguageService,
  TempoestUtils,
  type TempoestLanguageService,
  type TimeShiftResult,
  type BatchTimeShiftResult,
  type CompletionItem,
  type HoverInfo,
  type DiagnosticInfo,
  type CodeAction,
  type TextEdit
} from './core';

// Time manipulation utilities
export { 
  parseTimeOffset, 
  applyTimeOffset, 
  applyTimeOffsetToTimeString,
  validateTimeOffset,
  type TimeOffset,
  type TimeShiftResult as TimeUtilsResult
} from './time-utils';

// Commands (for advanced use cases)
export {
  executeTimeShift,
  executeBatchTimeShift,
  createTimeShiftCommand,
  type TimeShiftCommand
} from './commands/time-shift';

// Re-export core types that language service consumers might need
export {
  type ParsedLine,
  type TaskNode,
  type DirectiveNode,
  type Diagnostic,
  type Program,
  type AnalysisContext
} from '../types';

// Re-export main parser function
export { parseAndAnalyze } from '../index';
