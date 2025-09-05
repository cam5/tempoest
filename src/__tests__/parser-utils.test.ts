/**
 * Tests for parser utilities that ensure DRY principles
 */

import { 
  findTimeTokenInLine, 
  findDurationTokenInLine, 
  parseTimeString, 
  parseDurationString, 
  validateTaskLineFormat 
} from '../lsp/parser-utils';

describe('Parser Utilities - DRY Token Finding', () => {
  describe('findTimeTokenInLine', () => {
    test('finds TimeClock tokens', () => {
      const result = findTimeTokenInLine('- 9am, Task');
      expect(result).toEqual({
        timeStr: '9am',
        start: 2,
        end: 5,
        tokenType: 'TimeClock'
      });
    });

    test('finds 24-hour format', () => {
      const result = findTimeTokenInLine('- 14:30, Task');
      expect(result).toEqual({
        timeStr: '14:30',
        start: 2,
        end: 7,
        tokenType: 'TimeClock'
      });
    });

    test('finds TimeWord tokens', () => {
      const result = findTimeTokenInLine('- noon, Lunch');
      expect(result).toEqual({
        timeStr: 'noon',
        start: 2,
        end: 6,
        tokenType: 'TimeWord'
      });
    });

    test('finds midnight', () => {
      const result = findTimeTokenInLine('- midnight, Late task');
      expect(result).toEqual({
        timeStr: 'midnight',
        start: 2,
        end: 10,
        tokenType: 'TimeWord'
      });
    });

    test('returns null when no time found', () => {
      const result = findTimeTokenInLine('- Task without time');
      expect(result).toBeNull();
    });

    test('finds first time token when multiple exist', () => {
      const result = findTimeTokenInLine('- 9am, Task until 10am');
      expect(result?.timeStr).toBe('9am');
      expect(result?.start).toBe(2);
    });
  });

  describe('findDurationTokenInLine', () => {
    test('finds minute durations', () => {
      const result = findDurationTokenInLine('- Task, 30m');
      expect(result).toEqual({
        durationStr: '30m',
        start: 8,
        end: 11
      });
    });

    test('finds hour durations', () => {
      const result = findDurationTokenInLine('- Task, 2h');
      expect(result).toEqual({
        durationStr: '2h',
        start: 8,
        end: 10
      });
    });

    test('finds combined durations', () => {
      const result = findDurationTokenInLine('- Task, 1h30m');
      expect(result).toEqual({
        durationStr: '1h30m',
        start: 8,
        end: 13
      });
    });

    test('returns null when no duration found', () => {
      const result = findDurationTokenInLine('- Task without duration');
      expect(result).toBeNull();
    });
  });
});

describe('Parser Utilities - DRY Time Parsing', () => {
  describe('parseTimeString', () => {
    test('parses 12-hour format', () => {
      expect(parseTimeString('9am')).toEqual({ hours: 9, minutes: 0 });
      expect(parseTimeString('2:30pm')).toEqual({ hours: 14, minutes: 30 });
      expect(parseTimeString('12am')).toEqual({ hours: 0, minutes: 0 });
      expect(parseTimeString('12pm')).toEqual({ hours: 12, minutes: 0 });
    });

    test('parses 24-hour format', () => {
      expect(parseTimeString('14:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseTimeString('09:15')).toEqual({ hours: 9, minutes: 15 });
      expect(parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 });
    });

    test('parses special time words', () => {
      expect(parseTimeString('noon')).toEqual({ hours: 12, minutes: 0 });
      expect(parseTimeString('midnight')).toEqual({ hours: 0, minutes: 0 });
    });

    test('returns null for invalid formats', () => {
      expect(parseTimeString('25:00')).toBeNull();
      expect(parseTimeString('invalid')).toBeNull();
      expect(parseTimeString('')).toBeNull();
    });
  });

  describe('parseDurationString', () => {
    test('parses minute durations', () => {
      expect(parseDurationString('30m')).toBe(30);
      expect(parseDurationString('45m')).toBe(45);
    });

    test('parses hour durations', () => {
      expect(parseDurationString('2h')).toBe(120);
      expect(parseDurationString('1h')).toBe(60);
    });

    test('parses combined durations', () => {
      expect(parseDurationString('1h30m')).toBe(90);
      expect(parseDurationString('2h15m')).toBe(135);
    });

    test('returns null for invalid formats', () => {
      expect(parseDurationString('invalid')).toBeNull();
      expect(parseDurationString('30x')).toBeNull();
      expect(parseDurationString('')).toBeNull();
    });
  });
});

describe('Parser Utilities - Line Validation', () => {
  describe('validateTaskLineFormat', () => {
    test('validates proper task lines', () => {
      const result = validateTaskLineFormat('- 9am, Task, 30m');
      expect(result).toEqual({
        valid: true,
        hasDash: true,
        hasTime: true,
        hasDuration: true
      });
    });

    test('validates task without time', () => {
      const result = validateTaskLineFormat('- Task, 30m');
      expect(result).toEqual({
        valid: true,
        hasDash: true,
        hasTime: false,
        hasDuration: true
      });
    });

    test('validates task without duration', () => {
      const result = validateTaskLineFormat('- 9am, Task');
      expect(result).toEqual({
        valid: true,
        hasDash: true,
        hasTime: true,
        hasDuration: false
      });
    });

    test('validates minimal task', () => {
      const result = validateTaskLineFormat('- Task');
      expect(result).toEqual({
        valid: true,
        hasDash: true,
        hasTime: false,
        hasDuration: false
      });
    });

    test('rejects lines without dash', () => {
      const result = validateTaskLineFormat('Task without dash');
      expect(result.valid).toBe(false);
      expect(result.hasDash).toBe(false);
    });

    test('rejects comment lines', () => {
      const result = validateTaskLineFormat('# This is a comment');
      expect(result.valid).toBe(false);
    });

    test('rejects blank lines', () => {
      const result = validateTaskLineFormat('');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Parser Utilities - Consistency with Main Parser', () => {
  test('time parsing matches analyzer behavior', () => {
    // These should match the same patterns that the main analyzer accepts
    const validTimes = ['9am', '2:30pm', '14:30', 'noon', 'midnight', '12:00'];
    
    for (const timeStr of validTimes) {
      const found = findTimeTokenInLine(`- ${timeStr}, Task`);
      const parsed = parseTimeString(timeStr);
      
      expect(found).not.toBeNull();
      expect(parsed).not.toBeNull();
      expect(found?.timeStr).toBe(timeStr);
    }
  });

  test('duration parsing matches analyzer behavior', () => {
    const validDurations = ['30m', '1h', '2h30m', '45m'];
    
    for (const durationStr of validDurations) {
      const found = findDurationTokenInLine(`- Task, ${durationStr}`);
      const parsed = parseDurationString(durationStr);
      
      expect(found).not.toBeNull();
      expect(parsed).not.toBeNull();
      expect(found?.durationStr).toBe(durationStr);
    }
  });

  test('rejects same invalid patterns as main parser', () => {
    const invalidTimes = ['25:00', '9:70', 'invalid', '13pm'];
    const invalidDurations = ['30x', '1y', 'invalid'];
    
    for (const timeStr of invalidTimes) {
      expect(parseTimeString(timeStr)).toBeNull();
    }
    
    for (const durationStr of invalidDurations) {
      expect(parseDurationString(durationStr)).toBeNull();
    }
  });
});
