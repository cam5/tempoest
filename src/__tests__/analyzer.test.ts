import { parseAndAnalyze } from '../index';
import { ErrorCode, WarningCode } from '../types';

describe('Day Plan Analyzer', () => {
  describe('basic parsing and inference', () => {
    test('should parse and analyze implicit start chaining', () => {
      const source = `- 9am, A, 30m
- B
- C, 45m`;
      
      const result = parseAndAnalyze(source, { 
        today: '2025-01-15', 
        timezone: 'America/Toronto' 
      });
      
      expect(result.lines).toHaveLength(3);
      
      // Task A
      const taskA = result.lines[0].node as any;
      expect(taskA.kind).toBe('task');
      expect(taskA.title).toBe('A');
      expect(taskA.explicitStart).toBe(true);
      expect(taskA.explicitDuration).toBe(true);
      expect(taskA.durationMin).toBe(30);
      
      // Task B - should start at 9:30
      const taskB = result.lines[1].node as any;
      expect(taskB.kind).toBe('task');
      expect(taskB.title).toBe('B');
      expect(taskB.explicitStart).toBe(false);
      expect(taskB.explicitDuration).toBe(false);
      expect(taskB.durationMin).toBe(30); // default
      
      // Task C - should start at 10:00
      const taskC = result.lines[2].node as any;
      expect(taskC.kind).toBe('task');
      expect(taskC.title).toBe('C');
      expect(taskC.explicitStart).toBe(false);
      expect(taskC.explicitDuration).toBe(true);
      expect(taskC.durationMin).toBe(45);
    });
    
    test('should handle explicit start time reset', () => {
      const source = `- 9am A 30m
- B
- 11:00 C`;
      
      const result = parseAndAnalyze(source, { 
        today: '2025-01-15', 
        timezone: 'America/Toronto' 
      });
      
      expect(result.lines).toHaveLength(3);
      
      // Task B should start at 9:30
      const taskB = result.lines[1].node as any;
      expect(taskB.explicitStart).toBe(false);
      
      // Task C should start at 11:00 (explicit)
      const taskC = result.lines[2].node as any;
      expect(taskC.title).toBe('C');
      expect(taskC.explicitStart).toBe(true);
    });
    
    test('should parse categories correctly', () => {
      const source = '- Work block :work::planning';
      
      const result = parseAndAnalyze(source);
      
      const task = result.lines[0].node as any;
      expect(task.categories).toHaveLength(1);
      expect(task.categories[0].segments).toEqual(['work', 'planning']);
    });
    
    test('should handle multiple task components', () => {
      const source = '- 10:15, :work::meeting, Daily standup, 15m';
      
      const result = parseAndAnalyze(source);
      
      const task = result.lines[0].node as any;
      expect(task.title).toBe('Daily standup');
      expect(task.durationMin).toBe(15);
      expect(task.categories[0].segments).toEqual(['work', 'meeting']);
      expect(task.explicitStart).toBe(true);
      expect(task.explicitDuration).toBe(true);
    });
  });
  
  describe('warnings', () => {
    test('should warn on missing space after dash', () => {
      const source = `- 9am First task
-Second task 30m`;
      
      const result = parseAndAnalyze(source);
      
      // Second line should have missing space warning but still be valid
      expect(result.lines[1].status).toBe('valid-with-warnings');
      const missingSpaceWarning = result.lines[1].diagnostics.find(
        d => d.code === WarningCode.MISSING_SPACE_AFTER_DASH
      );
      expect(missingSpaceWarning).toBeDefined();
    });
    
    test('should warn on trailing comma', () => {
      const source = '- 9am, Email, 30m,';
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines[0].status).toBe('valid-with-warnings');
      const trailingCommaWarning = result.lines[0].diagnostics.find(
        d => d.code === WarningCode.TRAILING_COMMA
      );
      expect(trailingCommaWarning).toBeDefined();
    });
    
    test('should warn on overlaps by default', () => {
      const source = `- 9am Task A 1h
- 9:30am Task B 30m`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines[1].status).toBe('valid-with-warnings');
      const overlapWarning = result.lines[1].diagnostics.find(
        d => d.code === WarningCode.OVERLAP
      );
      expect(overlapWarning).toBeDefined();
    });
  });
  
  describe('errors', () => {
    test('should error on first task missing start time', () => {
      const source = '- Task without time';
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines[0].status).toBe('invalid');
      expect(result.lines[0].diagnostics[0].code).toBe(ErrorCode.MISSING_START_FIRST_LINE);
    });
    
    test('should error on bad duration', () => {
      const source = '- 9am Task 30x';
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines[0].status).toBe('invalid');
      const badDurationError = result.lines[0].diagnostics.find(
        d => d.code === ErrorCode.BAD_DURATION
      );
      expect(badDurationError).toBeDefined();
    });
    
    test('should error on bad category format', () => {
      const source = '- Task :home::';
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines[0].status).toBe('invalid');
      const badCategoryError = result.lines[0].diagnostics.find(
        d => d.code === ErrorCode.BAD_CATEGORY
      );
      expect(badCategoryError).toBeDefined();
    });
    
    test('should error on overlaps when policy is error', () => {
      const source = `- !policy overlaps=error
- 9am Task A 1h
- 9:30am Task B 30m`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines[2].status).toBe('invalid');
      const overlapError = result.lines[2].diagnostics.find(
        d => d.code === ErrorCode.OVERLAP
      );
      expect(overlapError).toBeDefined();
    });
  });
  
  describe('directives', () => {
    test('should apply default duration directive', () => {
      const source = `- !default duration=25m
- 9am Task without duration`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.context.defaultDurationMin).toBe(25);
      const task = result.lines[1].node as any;
      expect(task.durationMin).toBe(25);
      expect(task.explicitDuration).toBe(false);
    });
    
    test('should apply policy directive', () => {
      const source = `- !policy overlaps=ignore
- 9am Task A 1h
- 9:30am Task B 30m`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.context.overlapPolicy).toBe('ignore');
      // Should not have overlap warnings
      const overlapDiagnostics = result.lines[2].diagnostics.filter(
        d => d.code === WarningCode.OVERLAP || d.code === ErrorCode.OVERLAP
      );
      expect(overlapDiagnostics).toHaveLength(0);
    });
    
    test('should apply day directive', () => {
      const source = '- !day 2025-09-03';
      
      const result = parseAndAnalyze(source);
      
      expect(result.context.day).toBe('2025-09-03');
    });
    
    test('should apply timezone directive', () => {
      const source = '- !tz America/Toronto';
      
      const result = parseAndAnalyze(source);
      
      expect(result.context.timezone).toBe('America/Toronto');
    });
    
    test('should error on unknown directive', () => {
      const source = '- !unknown setting=value';
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines[0].status).toBe('invalid');
      expect(result.lines[0].diagnostics[0].code).toBe(ErrorCode.UNKNOWN_DIRECTIVE);
    });
  });
  
  describe('section directives', () => {
    test('should handle scratchpad directive and skip task parsing', () => {
      const source = `- 9am First task, 30m
- !scratchpad
- whatever notes here, 45m
- more notes :category
- !planner
- 10am Second task, 15m`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines).toHaveLength(6);
      
      // First task should be parsed normally
      const firstTask = result.lines[0].node as any;
      expect(firstTask.kind).toBe('task');
      expect(firstTask.title).toBe('First task');
      expect(firstTask.durationMin).toBe(30);
      
      // Scratchpad directive
      const scratchpadDirective = result.lines[1].node as any;
      expect(scratchpadDirective.kind).toBe('directive');
      expect(scratchpadDirective.name).toBe('scratchpad');
      
      // Lines in scratchpad should not be parsed as tasks
      expect(result.lines[2].node).toBeNull();
      expect(result.lines[2].status).toBe('valid');
      expect(result.lines[3].node).toBeNull();
      expect(result.lines[3].status).toBe('valid');
      
      // Planner directive
      const plannerDirective = result.lines[4].node as any;
      expect(plannerDirective.kind).toBe('directive');
      expect(plannerDirective.name).toBe('planner');
      
      // Second task should be parsed normally after planner directive
      const secondTask = result.lines[5].node as any;
      expect(secondTask.kind).toBe('task');
      expect(secondTask.title).toBe('Second task');
      expect(secondTask.durationMin).toBe(15);
    });
    
    test('should default to planner section', () => {
      const source = `- 9am Task A, 30m
- Task B, 45m`;
      
      const result = parseAndAnalyze(source);
      
      // Both tasks should be parsed normally (default planner section)
      expect(result.lines[0].node?.kind).toBe('task');
      expect(result.lines[1].node?.kind).toBe('task');
    });
    
    test('should handle multiple section switches', () => {
      const source = `- 9am Task A
- !scratchpad
- note 1
- !planner
- Task B
- !scratchpad
- note 2
- !planner
- Task C`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines).toHaveLength(9);
      
      // Task A (planner)
      expect(result.lines[0].node?.kind).toBe('task');
      
      // Scratchpad directive
      expect((result.lines[1].node as any)?.name).toBe('scratchpad');
      
      // Note 1 (scratchpad - not parsed as task)
      expect(result.lines[2].node).toBeNull();
      
      // Planner directive
      expect((result.lines[3].node as any)?.name).toBe('planner');
      
      // Task B (planner)
      expect(result.lines[4].node?.kind).toBe('task');
      
      // Scratchpad directive
      expect((result.lines[5].node as any)?.name).toBe('scratchpad');
      
      // Note 2 (scratchpad - not parsed as task)
      expect(result.lines[6].node).toBeNull();
      
      // Planner directive
      expect((result.lines[7].node as any)?.name).toBe('planner');
      
      // Task C (planner)
      expect(result.lines[8].node?.kind).toBe('task');
    });
    
    test('should handle scratchpad with time-like content', () => {
      const source = `- 9am Real task, 30m
- !scratchpad
- 10am fake task, 45m :work
- another note with 1h duration
- !planner
- 11am Second task, 15m`;
      
      const result = parseAndAnalyze(source);
      
      // Real task should be parsed
      const realTask1 = result.lines[0].node as any;
      expect(realTask1.kind).toBe('task');
      expect(realTask1.title).toBe('Real task');
      
      // Scratchpad lines should not be parsed as tasks even with time-like content
      expect(result.lines[2].node).toBeNull();
      expect(result.lines[3].node).toBeNull();
      
      // Second task should be parsed after returning to planner
      const secondTask = result.lines[5].node as any;
      expect(secondTask.kind).toBe('task');
      expect(secondTask.title).toBe('Second task');
    });
    
    test('should handle empty scratchpad sections', () => {
      const source = `- 9am Task A
- !scratchpad
- !planner
- Task B`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines).toHaveLength(4);
      expect(result.lines[0].node?.kind).toBe('task');
      expect((result.lines[1].node as any)?.name).toBe('scratchpad');
      expect((result.lines[2].node as any)?.name).toBe('planner');
      expect(result.lines[3].node?.kind).toBe('task');
    });
    
    test('should handle comments and blank lines in scratchpad', () => {
      const source = `- 9am Task A
- !scratchpad
# This is a comment in scratchpad
- some task-like content

- more content
- !planner
- Task B`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines).toHaveLength(8);
      
      // Task A
      expect(result.lines[0].node?.kind).toBe('task');
      
      // Scratchpad directive
      expect((result.lines[1].node as any)?.name).toBe('scratchpad');
      
      // Comment line (should be valid)
      expect(result.lines[2].node).toBeNull();
      expect(result.lines[2].status).toBe('valid');
      
      // Scratchpad content (should not be parsed as task)
      expect(result.lines[3].node).toBeNull();
      expect(result.lines[3].status).toBe('valid');
      
      // Blank line
      expect(result.lines[4].node).toBeNull();
      expect(result.lines[4].status).toBe('valid');
      
      // More scratchpad content
      expect(result.lines[5].node).toBeNull();
      expect(result.lines[5].status).toBe('valid');
      
      // Planner directive
      expect((result.lines[6].node as any)?.name).toBe('planner');
      
      // Task B
      expect(result.lines[7].node?.kind).toBe('task');
    });
    
    test('should handle bare directive format (without dash)', () => {
      const source = `- 9am Task A, 30m
!scratchpad
- scratchpad content here
!planner
- Task B, 15m`;
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines).toHaveLength(5);
      
      // Task A
      expect(result.lines[0].node?.kind).toBe('task');
      
      // Scratchpad directive (bare format)
      expect((result.lines[1].node as any)?.name).toBe('scratchpad');
      
      // Scratchpad content should not be parsed as task
      expect(result.lines[2].node).toBeNull();
      expect(result.lines[2].status).toBe('valid');
      
      // Planner directive (bare format)
      expect((result.lines[3].node as any)?.name).toBe('planner');
      
      // Task B
      expect(result.lines[4].node?.kind).toBe('task');
    });
  });
  
  describe('time parsing', () => {
    test('should parse various time formats', () => {
      const timeFormats = [
        '9am',
        '9:00am', 
        '09:15',
        '21:00',
        'noon',
        'midnight'
      ];
      
      timeFormats.forEach(timeFormat => {
        const source = `- ${timeFormat} Task`;
        const result = parseAndAnalyze(source);
        
        expect(result.lines[0].status).not.toBe('invalid');
        const task = result.lines[0].node as any;
        expect(task.explicitStart).toBe(true);
      });
    });
    
    test('should parse various duration formats', () => {
      const durationFormats = [
        '30m',
        '1h',
        '1h30m',
        '2h15m'
      ];
      
      durationFormats.forEach(duration => {
        const source = `- 9am Task ${duration}`;
        const result = parseAndAnalyze(source);
        
        expect(result.lines[0].status).not.toBe('invalid');
        const task = result.lines[0].node as any;
        expect(task.explicitDuration).toBe(true);
      });
    });
  });
  
  describe('round-trip compatibility', () => {
    test('should generate stable IDs', () => {
      const source = '- 9am Task A';
      
      const result1 = parseAndAnalyze(source);
      const result2 = parseAndAnalyze(source);
      
      expect(result1.lines[0].id).toBe(result2.lines[0].id);
    });
    
    test('should preserve raw text', () => {
      const source = '- 9am, Clear inbox, 30m, :work::planning';
      
      const result = parseAndAnalyze(source);
      
      expect(result.lines[0].raw).toBe(source);
    });
  });
});
