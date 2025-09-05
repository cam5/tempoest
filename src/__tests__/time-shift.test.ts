/**
 * Tests for time shifting functionality
 */

import { parseAndAnalyze } from '../index';
import { parseTimeOffset, applyTimeOffsetToTimeString, validateTimeOffset } from '../lsp/time-utils';
import { executeTimeShift } from '../lsp/commands/time-shift';
import { TaskNode } from '../types';

describe('Time Offset Parsing', () => {
  test('parses positive offsets', () => {
    expect(parseTimeOffset('+10m')).toEqual({ hours: 0, minutes: 10, sign: 1 });
    expect(parseTimeOffset('+1h')).toEqual({ hours: 1, minutes: 0, sign: 1 });
    expect(parseTimeOffset('+1h30m')).toEqual({ hours: 1, minutes: 30, sign: 1 });
    expect(parseTimeOffset('+2h15m')).toEqual({ hours: 2, minutes: 15, sign: 1 });
  });

  test('parses negative offsets', () => {
    expect(parseTimeOffset('-10m')).toEqual({ hours: 0, minutes: 10, sign: -1 });
    expect(parseTimeOffset('-1h')).toEqual({ hours: 1, minutes: 0, sign: -1 });
    expect(parseTimeOffset('-1h30m')).toEqual({ hours: 1, minutes: 30, sign: -1 });
  });

  test('rejects invalid formats', () => {
    expect(parseTimeOffset('10m')).toBeNull(); // Missing sign
    expect(parseTimeOffset('+0m')).toBeNull(); // Zero offset
    expect(parseTimeOffset('+h')).toBeNull(); // Missing number
    expect(parseTimeOffset('+1x')).toBeNull(); // Invalid unit
    expect(parseTimeOffset('')).toBeNull(); // Empty
  });
});

describe('Time String Manipulation', () => {
  test('shifts 12-hour format times', () => {
    expect(applyTimeOffsetToTimeString('9am', { hours: 0, minutes: 15, sign: 1 }))
      .toEqual({ success: true, newTime: '9:15am' });
    
    expect(applyTimeOffsetToTimeString('9:30am', { hours: 1, minutes: 0, sign: 1 }))
      .toEqual({ success: true, newTime: '10:30am' });
    
    expect(applyTimeOffsetToTimeString('11:45pm', { hours: 0, minutes: 30, sign: 1 }))
      .toEqual({ success: true, newTime: '12:15am' });
  });

  test('shifts 24-hour format times', () => {
    expect(applyTimeOffsetToTimeString('14:30', { hours: 1, minutes: 15, sign: 1 }))
      .toEqual({ success: true, newTime: '15:45' });
    
    expect(applyTimeOffsetToTimeString('23:45', { hours: 0, minutes: 30, sign: 1 }))
      .toEqual({ success: true, newTime: '00:15' });
  });

  test('shifts special time words', () => {
    expect(applyTimeOffsetToTimeString('noon', { hours: 1, minutes: 0, sign: 1 }))
      .toEqual({ success: true, newTime: '1pm' });
    
    expect(applyTimeOffsetToTimeString('midnight', { hours: 0, minutes: 30, sign: 1 }))
      .toEqual({ success: true, newTime: '12:30am' });
  });

  test('handles negative shifts', () => {
    expect(applyTimeOffsetToTimeString('10am', { hours: 0, minutes: 30, sign: -1 }))
      .toEqual({ success: true, newTime: '9:30am' });
    
    expect(applyTimeOffsetToTimeString('12:15am', { hours: 0, minutes: 30, sign: -1 }))
      .toEqual({ success: true, newTime: '11:45pm' });
  });

  test('handles day boundary crossings', () => {
    // Forward past midnight
    expect(applyTimeOffsetToTimeString('23:30', { hours: 1, minutes: 0, sign: 1 }))
      .toEqual({ success: true, newTime: '00:30' });
    
    // Backward past midnight
    expect(applyTimeOffsetToTimeString('00:30', { hours: 1, minutes: 0, sign: -1 }))
      .toEqual({ success: true, newTime: '23:30' });
  });
});

describe('Time Shift Validation', () => {
  test('validates correct formats', () => {
    expect(validateTimeOffset('+10m')).toEqual({ valid: true });
    expect(validateTimeOffset('-1h30m')).toEqual({ valid: true });
    expect(validateTimeOffset('+2h')).toEqual({ valid: true });
  });

  test('rejects invalid formats', () => {
    expect(validateTimeOffset('')).toEqual({ 
      valid: false, 
      error: 'Offset cannot be empty' 
    });
    
    expect(validateTimeOffset('10m')).toEqual({ 
      valid: false, 
      error: 'Invalid offset format. Use +/-[Nh][Nm] (e.g., +10m, -1h30m, +2h)' 
    });
    
    expect(validateTimeOffset('+15h')).toEqual({ 
      valid: false, 
      error: 'Offset too large (max 12 hours)' 
    });
  });
});

describe('Line Time Shifting', () => {
  test('shifts explicit time in task line', () => {
    const source = '- 9am, Clear inbox, 30m, :work';
    const result = parseAndAnalyze(source);
    const line = result.lines[0];
    
    const shiftResult = executeTimeShift(line, '+15m');
    
    expect(shiftResult.success).toBe(true);
    expect(shiftResult.newLineContent).toBe('- 9:15am, Clear inbox, 30m, :work');
  });

  test('adds explicit time to task without one', () => {
    const source = `- 9am, First task, 30m
- Second task, 45m`;
    
    const result = parseAndAnalyze(source);
    const secondLine = result.lines[1];
    
    const shiftResult = executeTimeShift(secondLine, '+10m');
    
    expect(shiftResult.success).toBe(true);
    expect(shiftResult.newLineContent).toBe('- 9:40am, Second task, 45m');
  });

  test('handles various time formats in lines', () => {
    const testCases = [
      { input: '- 2pm, Afternoon task', offset: '+30m', expected: '- 2:30pm, Afternoon task' },
      { input: '- 14:30, Military time task', offset: '-15m', expected: '- 14:15, Military time task' },
      { input: '- noon, Lunch break', offset: '+1h', expected: '- 1pm, Lunch break' },
      { input: '- midnight, Late task', offset: '+30m', expected: '- 12:30am, Late task' }
    ];

    for (const testCase of testCases) {
      const result = parseAndAnalyze(testCase.input);
      const line = result.lines[0];
      
      const shiftResult = executeTimeShift(line, testCase.offset);
      
      expect(shiftResult.success).toBe(true);
      expect(shiftResult.newLineContent).toBe(testCase.expected);
    }
  });

  test('fails gracefully on non-task lines', () => {
    const source = '# This is a comment';
    const result = parseAndAnalyze(source);
    const line = result.lines[0];
    
    const shiftResult = executeTimeShift(line, '+15m');
    
    expect(shiftResult.success).toBe(false);
    expect(shiftResult.error).toContain('Time shift can only be applied to task lines');
  });

  test('fails on invalid offset', () => {
    const source = '- 9am, Task';
    const result = parseAndAnalyze(source);
    const line = result.lines[0];
    
    const shiftResult = executeTimeShift(line, 'invalid');
    
    expect(shiftResult.success).toBe(false);
    expect(shiftResult.error).toContain('Invalid offset format');
  });

  test('identifies affected subsequent lines', () => {
    const source = `- 9am, First task, 30m
- Second task, 30m
- Third task, 30m
- 11am, Fourth task, 30m`;
    
    const result = parseAndAnalyze(source);
    const firstLine = result.lines[0];
    
    const shiftResult = executeTimeShift(firstLine, '+15m', result.lines);
    
    expect(shiftResult.success).toBe(true);
    expect(shiftResult.affectedLines).toHaveLength(2); // Second and third tasks
    expect(shiftResult.affectedLines).toEqual([result.lines[1].id, result.lines[2].id]);
  });
});

describe('Complex Time Shifting Scenarios', () => {
  test('handles time shifts across day boundaries', () => {
    const source = '- 11:45pm, Late task, 30m';
    const result = parseAndAnalyze(source);
    const line = result.lines[0];
    
    const shiftResult = executeTimeShift(line, '+30m');
    
    expect(shiftResult.success).toBe(true);
    expect(shiftResult.newLineContent).toBe('- 12:15am, Late task, 30m');
  });

  test('preserves line formatting and comments', () => {
    const source = '- 9am, Task with comment, 30m  # Important task';
    const result = parseAndAnalyze(source);
    const line = result.lines[0];
    
    const shiftResult = executeTimeShift(line, '+15m');
    
    expect(shiftResult.success).toBe(true);
    expect(shiftResult.newLineContent).toBe('- 9:15am, Task with comment, 30m  # Important task');
  });

  test('handles tasks with multiple categories', () => {
    const source = '- 9am, Complex task, 30m, :work::meeting, :urgent';
    const result = parseAndAnalyze(source);
    const line = result.lines[0];
    
    const shiftResult = executeTimeShift(line, '+45m');
    
    expect(shiftResult.success).toBe(true);
    expect(shiftResult.newLineContent).toBe('- 9:45am, Complex task, 30m, :work::meeting, :urgent');
  });
});
