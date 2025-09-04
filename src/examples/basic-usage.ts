import { parseAndAnalyze } from '../index';

// Example demonstrating basic usage of the day-planning DSL
export function basicUsageExample(): void {
  console.log('=== Day Planning DSL - Basic Usage ===\n');
  
  const dayPlan = `# My daily schedule
- !day 2025-01-15
- !default duration=25m
- !policy overlaps=warning

- 9am, Clear inbox, 30m, :work::planning
- Tidy kitchen :home::cleaning
- 10:15, :work::meeting, Daily standup, 15m
- 11:00am 45m Deep work :work::focus
- 12:30pm Lunch break, 1h, :personal
- 2pm, Review PRs, :work::review
- 4pm Team meeting, 1h, :work::meeting`;
  
  console.log('Input DSL:');
  console.log(dayPlan);
  console.log('\n' + '='.repeat(60) + '\n');
  
  try {
    const result = parseAndAnalyze(dayPlan, {
      today: '2025-01-15',
      timezone: 'America/Toronto'
    });
    
    console.log('Analysis Results:\n');
    
    // Show context
    console.log('Context:');
    console.log(`  Day: ${result.context.day}`);
    console.log(`  Timezone: ${result.context.timezone}`);
    console.log(`  Default Duration: ${result.context.defaultDurationMin}m`);
    console.log(`  Overlap Policy: ${result.context.overlapPolicy}`);
    console.log();
    
    // Show parsed lines
    console.log('Parsed Lines:');
    result.lines.forEach(line => {
      if (line.node?.kind === 'task') {
        const task = line.node;
        const startTime = task.start ? new Date(task.start).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }) : 'N/A';
        const endTime = task.end ? new Date(task.end).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }) : 'N/A';
        
        console.log(`  ${startTime}-${endTime}: ${task.title} (${task.durationMin}m)`);
        
        if (task.categories.length > 0) {
          const categoryStrs = task.categories.map(cat => cat.segments.join('::'));
          console.log(`    Categories: ${categoryStrs.join(', ')}`);
        }
        
        if (line.diagnostics.length > 0) {
          console.log(`    Diagnostics: ${line.diagnostics.map(d => d.code).join(', ')}`);
        }
      } else if (line.node?.kind === 'directive') {
        const directive = line.node;
        console.log(`  Directive: ${directive.name} ${JSON.stringify(directive.args)}`);
      } else if (line.raw.trim().startsWith('#') || line.raw.trim().startsWith('//')) {
        console.log(`  Comment: ${line.raw.trim()}`);
      }
    });
    
    // Show summary
    console.log('\nSummary:');
    const tasks = result.lines.filter(line => line.node?.kind === 'task');
    const validTasks = tasks.filter(line => line.status === 'valid');
    const warningTasks = tasks.filter(line => line.status === 'valid-with-warnings');
    const invalidTasks = tasks.filter(line => line.status === 'invalid');
    
    console.log(`  Total tasks: ${tasks.length}`);
    console.log(`  Valid: ${validTasks.length}`);
    console.log(`  With warnings: ${warningTasks.length}`);
    console.log(`  Invalid: ${invalidTasks.length}`);
    
    const totalTime = tasks
      .filter(line => line.node?.kind === 'task')
      .reduce((sum, line) => sum + ((line.node as any).durationMin || 0), 0);
    
    console.log(`  Total planned time: ${Math.floor(totalTime / 60)}h ${totalTime % 60}m`);
    
  } catch (error) {
    console.error('Error parsing day plan:', error);
  }
}

// Example showing error handling and diagnostics
export function diagnosticsExample(): void {
  console.log('\n=== Diagnostics and Error Handling ===\n');
  
  const problematicPlan = `# Plan with various issues
-Missing space task, 30m
- 9am First task, 1h
- 9:30am Overlapping task, 45m  # This will overlap!
- Bad time 25:99, Some task
- Another task, 30x  # Bad duration
- Category task :invalid::  # Bad category
- Final task, 25m,  # Trailing comma`;
  
  console.log('Input with problems:');
  console.log(problematicPlan);
  console.log('\n' + '='.repeat(60) + '\n');
  
  const result = parseAndAnalyze(problematicPlan);
  
  console.log('Diagnostic Report:');
  result.lines.forEach(line => {
    if (line.diagnostics.length > 0) {
      console.log(`\nLine ${line.lineNo}: "${line.raw}"`);
      console.log(`Status: ${line.status}`);
      line.diagnostics.forEach(diag => {
        const type = diag.code.startsWith('E') ? 'ERROR' : 'WARNING';
        console.log(`  ${type}: ${diag.code} - ${diag.message}`);
        if (diag.span) {
          console.log(`    Location: columns ${diag.span.startCol}-${diag.span.endCol}`);
        }
      });
    }
  });
  
  // Summary of issues
  const allDiagnostics = result.lines.flatMap(line => line.diagnostics);
  const errors = allDiagnostics.filter(d => d.code.startsWith('E'));
  const warnings = allDiagnostics.filter(d => d.code.startsWith('W'));
  
  console.log(`\nSummary: ${errors.length} errors, ${warnings.length} warnings`);
}

// Example showing directive usage
export function directivesExample(): void {
  console.log('\n=== Directives and Configuration ===\n');
  
  const planWithDirectives = `# Configuration example
- !day 2025-01-15
- !tz America/New_York
- !default duration=20m
- !policy overlaps=error

- 9am Morning routine, 30m, :personal
- Work session, :work::focus  # Uses default 20m
- 10am Another session, :work::coding
- 10:15am This will error due to overlap policy`;
  
  console.log('Input with directives:');
  console.log(planWithDirectives);
  console.log('\n' + '='.repeat(60) + '\n');
  
  const result = parseAndAnalyze(planWithDirectives);
  
  console.log('Applied Configuration:');
  console.log(`  Day: ${result.context.day}`);
  console.log(`  Timezone: ${result.context.timezone}`);
  console.log(`  Default Duration: ${result.context.defaultDurationMin}m`);
  console.log(`  Overlap Policy: ${result.context.overlapPolicy}`);
  
  console.log('\nProcessed Tasks:');
  result.lines.forEach(line => {
    if (line.node?.kind === 'task') {
      const task = line.node;
      console.log(`  ${task.title}: ${task.durationMin}m (explicit: ${task.explicitDuration})`);
      if (line.status === 'invalid') {
        console.log(`    ❌ INVALID: ${line.diagnostics.map(d => d.code).join(', ')}`);
      } else if (line.status === 'valid-with-warnings') {
        console.log(`    ⚠️  WARNINGS: ${line.diagnostics.map(d => d.code).join(', ')}`);
      } else {
        console.log(`    ✅ VALID`);
      }
    }
  });
}

// Run examples if this file is executed directly
if (require.main === module) {
  basicUsageExample();
  diagnosticsExample();
  directivesExample();
}