/**
 * Time shifting commands for LSP
 */

import { ParsedLine, TaskNode } from '../../types';
import { parseTimeOffset, applyTimeOffsetToTimeString, validateTimeOffset } from '../time-utils';
import { findTimeTokenInLine, validateTaskLineFormat } from '../parser-utils';

export interface TimeShiftCommand {
  type: 'shift-time';
  lineId: string;
  offset: string; // e.g., "+10m", "-1h30m"
}

export interface TimeShiftResult {
  success: boolean;
  newLineContent?: string;
  error?: string;
  affectedLines?: string[]; // IDs of other lines that might need updating
}

/**
 * Execute a time shift command on a parsed line
 */
export function executeTimeShift(
  line: ParsedLine, 
  offset: string,
  allLines: ParsedLine[] = []
): TimeShiftResult {
  // Validate offset format
  const validation = validateTimeOffset(offset);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  // Only works on task lines
  if (line.node?.kind !== 'task') {
    return { 
      success: false, 
      error: 'Time shift can only be applied to task lines' 
    };
  }
  
  // Additional validation using parser utilities to ensure line format is correct
  const lineValidation = validateTaskLineFormat(line.raw);
  if (!lineValidation.valid) {
    return {
      success: false,
      error: 'Invalid task line format - missing dash or malformed syntax'
    };
  }
  
  const task = line.node as TaskNode;
  
  // Find the time part in the original line to replace
  const timeShiftResult = shiftTaskTime(line.raw, task, offset);
  if (!timeShiftResult.success) {
    return timeShiftResult;
  }
  
  // Check if we need to update subsequent tasks (if they don't have explicit start times)
  const affectedLines = findAffectedLines(line, allLines);
  
  return {
    success: true,
    newLineContent: timeShiftResult.newLineContent,
    affectedLines: affectedLines.map(l => l.id)
  };
}

/**
 * Shift the time in a task line's raw text
 */
function shiftTaskTime(rawLine: string, task: TaskNode, offset: string): TimeShiftResult {
  const parsedOffset = parseTimeOffset(offset);
  if (!parsedOffset) {
    return { success: false, error: 'Invalid offset format' };
  }
  
  // If task has explicit start time, find and replace it in the raw line
  if (task.explicitStart && task.start) {
    const timeToken = findTimeTokenInLine(rawLine);
    if (!timeToken) {
      return { 
        success: false, 
        error: 'Could not locate time in line to modify' 
      };
    }
    
    // Apply offset to the found time string
    const shiftResult = applyTimeOffsetToTimeString(timeToken.timeStr, parsedOffset);
    if (!shiftResult.success) {
      return { success: false, error: shiftResult.error };
    }
    
    // Replace the time in the original line
    const newLine = rawLine.substring(0, timeToken.start) + 
                   shiftResult.newTime + 
                   rawLine.substring(timeToken.end);
    
    return { success: true, newLineContent: newLine };
  }
  
  // If task doesn't have explicit start time, we need to add one
  if (!task.explicitStart && task.start) {
    // Calculate what the new time should be
    const currentTime = new Date(task.start);
    const totalMinutes = (parsedOffset.hours * 60 + parsedOffset.minutes) * parsedOffset.sign;
    currentTime.setMinutes(currentTime.getMinutes() + totalMinutes);
    
    // Format as a simple time string
    const newTimeStr = formatTimeForInsertion(currentTime);
    
    // Insert the time at the beginning of the task content (after the dash)
    const dashMatch = rawLine.match(/^(\s*-\s*)(.*)/);
    if (!dashMatch) {
      return { success: false, error: 'Invalid task line format' };
    }
    
    const [, prefix, content] = dashMatch;
    const newLine = `${prefix}${newTimeStr}, ${content}`;
    
    return { success: true, newLineContent: newLine };
  }
  
  return { 
    success: false, 
    error: 'Task has no time information to shift' 
  };
}

// Note: findTimeInLine function removed - now using findTimeTokenInLine from parser-utils
// This eliminates code duplication and ensures we use the same lexer logic

/**
 * Format a Date object as a time string for insertion into a line
 * Uses the same format style as the existing time parsing logic
 */
function formatTimeForInsertion(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Handle special cases that match our TimeWord tokens
  if (hours === 12 && minutes === 0) return 'noon';
  if (hours === 0 && minutes === 0) return 'midnight';
  
  // Use 12-hour format for readability (matches TimeClock token expectations)
  let displayHours = hours;
  const ampm = hours >= 12 ? 'pm' : 'am';
  
  if (displayHours === 0) displayHours = 12;
  if (displayHours > 12) displayHours -= 12;
  
  if (minutes === 0) {
    return `${displayHours}${ampm}`;
  } else {
    return `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`;
  }
}

/**
 * Find lines that might be affected by shifting this task's time
 * (subsequent tasks without explicit start times)
 */
function findAffectedLines(shiftedLine: ParsedLine, allLines: ParsedLine[]): ParsedLine[] {
  const shiftedIndex = allLines.findIndex(l => l.id === shiftedLine.id);
  if (shiftedIndex === -1) return [];
  
  const affected: ParsedLine[] = [];
  
  // Look at subsequent lines
  for (let i = shiftedIndex + 1; i < allLines.length; i++) {
    const line = allLines[i];
    
    // Stop if we hit a task with explicit start time
    if (line.node?.kind === 'task' && (line.node as TaskNode).explicitStart) {
      break;
    }
    
    // Add tasks without explicit start times
    if (line.node?.kind === 'task' && !(line.node as TaskNode).explicitStart) {
      affected.push(line);
    }
  }
  
  return affected;
}

/**
 * Create a time shift command
 */
export function createTimeShiftCommand(lineId: string, offset: string): TimeShiftCommand {
  return {
    type: 'shift-time',
    lineId,
    offset
  };
}

/**
 * Batch time shift - shift multiple lines by the same offset
 */
export function executeBatchTimeShift(
  lines: ParsedLine[],
  offset: string
): { success: boolean; results: Map<string, TimeShiftResult>; error?: string } {
  const validation = validateTimeOffset(offset);
  if (!validation.valid) {
    return { success: false, results: new Map(), error: validation.error };
  }
  
  const results = new Map<string, TimeShiftResult>();
  let hasErrors = false;
  
  for (const line of lines) {
    const result = executeTimeShift(line, offset, lines);
    results.set(line.id, result);
    
    if (!result.success) {
      hasErrors = true;
    }
  }
  
  return { 
    success: !hasErrors, 
    results,
    error: hasErrors ? 'Some lines failed to shift' : undefined
  };
}
