import { parseAndAnalyze } from '../index';

describe('Day Plan Integration Tests', () => {
  test('should match expected IR format from specification', () => {
    const source = `- 9am, Clear inbox, 30m, :work::planning
- Tidy kitchen :home::cleaning`;
    
    const result = parseAndAnalyze(source, {
      today: '2025-09-03',
      timezone: 'America/Toronto'
    });
    
    // Check overall structure
    expect(result.context.day).toBe('2025-09-03');
    expect(result.context.timezone).toBe('America/Toronto');
    expect(result.context.defaultDurationMin).toBe(30);
    expect(result.context.overlapPolicy).toBe('warning');
    
    expect(result.lines).toHaveLength(2);
    
    // First line
    const line1 = result.lines[0];
    expect(line1.raw).toBe('- 9am, Clear inbox, 30m, :work::planning');
    expect(line1.lineNo).toBe(1);
    expect(line1.status).toBe('valid');
    expect(line1.diagnostics).toHaveLength(0);
    expect(line1.id).toBeDefined();
    
    const task1 = line1.node as any;
    expect(task1.kind).toBe('task');
    expect(task1.title).toBe('Clear inbox');
    expect(task1.start).toBeDefined();
    expect(task1.durationMin).toBe(30);
    expect(task1.end).toBeDefined();
    expect(task1.categories).toHaveLength(1);
    expect(task1.categories[0].segments).toEqual(['work', 'planning']);
    expect(task1.explicitStart).toBe(true);
    expect(task1.explicitDuration).toBe(true);
    
    // Second line
    const line2 = result.lines[1];
    expect(line2.raw).toBe('- Tidy kitchen :home::cleaning');
    expect(line2.lineNo).toBe(2);
    expect(line2.status).toBe('valid');
    expect(line2.diagnostics).toHaveLength(0);
    
    const task2 = line2.node as any;
    expect(task2.kind).toBe('task');
    expect(task2.title).toBe('Tidy kitchen');
    expect(task2.start).toBeDefined();
    expect(task2.durationMin).toBe(30); // default
    expect(task2.end).toBeDefined();
    expect(task2.categories).toHaveLength(1);
    expect(task2.categories[0].segments).toEqual(['home', 'cleaning']);
    expect(task2.explicitStart).toBe(false);
    expect(task2.explicitDuration).toBe(false);
    
    // Verify time chaining - task2 should start when task1 ends
    const task1End = new Date(task1.end);
    const task2Start = new Date(task2.start);
    expect(task1End.getTime()).toBe(task2Start.getTime());
  });
  
  test('should handle complex real-world example', () => {
    const source = `# Daily schedule for 2025-01-15
- !day 2025-01-15
- !default duration=25m
- !policy overlaps=warning

- 9am, Clear inbox, 30m, :work::planning
- Tidy kitchen :home::cleaning
- 10:15, :work::meeting, Daily standup, 15m
- 11:00am 45m Deep work :work::focus
- 12:30pm Lunch break, 1h, :personal

# Afternoon tasks
- 2pm, Review PRs, :work::review
-Urgent fix, 20m  # Missing space after dash
- 4pm Team meeting, 1h, :work::meeting,  # Trailing comma

# Overlap test
- 4:30pm, Conflicting task, 45m`;
    
    const result = parseAndAnalyze(source, {
      today: '2025-01-15',
      timezone: 'America/Toronto'
    });
    
    // Should have applied directives
    expect(result.context.day).toBe('2025-01-15');
    expect(result.context.defaultDurationMin).toBe(25);
    expect(result.context.overlapPolicy).toBe('warning');
    
    // Check for expected warnings and errors
    const allDiagnostics = result.lines.flatMap(line => line.diagnostics);
    const warningCodes = allDiagnostics.map(d => d.code);
    
    expect(warningCodes).toContain('W001-missing-space-after-dash');
    expect(warningCodes).toContain('W005-trailing-comma');
    expect(warningCodes).toContain('W010-overlap');
    
    // Verify some tasks
    const tasks = result.lines
      .filter(line => line.node?.kind === 'task')
      .map(line => line.node as any);
    
    expect(tasks.length).toBeGreaterThan(5);
    
    // Check that times are properly chained
    for (let i = 1; i < tasks.length; i++) {
      const prevTask = tasks[i - 1];
      const currentTask = tasks[i];
      
      if (prevTask.end && currentTask.start && !currentTask.explicitStart) {
        const prevEnd = new Date(prevTask.end);
        const currentStart = new Date(currentTask.start);
        expect(prevEnd.getTime()).toBe(currentStart.getTime());
      }
    }
  });
  
  test('should handle edge cases gracefully', () => {
    const source = `
# Empty lines and comments should be handled

- 9am First task

# Another comment
- Second task with default duration

- !policy overlaps=error
- 10am Overlapping task, 2h
- 11am This should error due to overlap

# Bad formats
- Invalid time format 25:99
- Bad duration 30x
- Bad category :invalid::
`;
    
    const result = parseAndAnalyze(source);
    
    // Should not crash and should provide diagnostics
    expect(result.lines.length).toBeGreaterThan(0);
    
    const errors = result.lines.flatMap(line => 
      line.diagnostics.filter(d => d.code.startsWith('E'))
    );
    
    expect(errors.length).toBeGreaterThan(0);
    
    // Should have overlap error due to policy
    const overlapErrors = errors.filter(e => e.code === 'E030-overlap');
    expect(overlapErrors.length).toBeGreaterThan(0);
    
    // Should have format errors
    const formatErrors = errors.filter(e => 
      e.code === 'E001-bad-time' || 
      e.code === 'E010-bad-duration' || 
      e.code === 'E050-bad-category'
    );
    expect(formatErrors.length).toBeGreaterThan(0);
  });
  
  test('should handle blank input', () => {
    const result = parseAndAnalyze('');
    
    // Empty string creates one empty line
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].node).toBe(null);
    expect(result.context.defaultDurationMin).toBe(30);
    expect(result.context.overlapPolicy).toBe('warning');
  });
  
  test('should handle only comments and blank lines', () => {
    const source = `
# Just comments
// And slash comments

# Nothing else
`;
    
    const result = parseAndAnalyze(source);
    
    // Should have lines but no tasks or directives
    expect(result.lines.length).toBeGreaterThan(0);
    const nodes = result.lines.map(line => line.node).filter(Boolean);
    expect(nodes).toHaveLength(0);
  });
});
