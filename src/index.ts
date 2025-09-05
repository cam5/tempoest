import { DayPlanAnalyzer } from './analyzer/analyzer';
import { Program, ParseOptions } from './types';

/**
 * Main API function to parse and analyze day-planning DSL
 * 
 * @param source - The DSL source code as a string
 * @param options - Optional parsing options
 * @returns Analyzed program with context and parsed lines
 */
export function parseAndAnalyze(source: string, options: ParseOptions = {}): Program {
  const analyzer = new DayPlanAnalyzer(options);
  return analyzer.analyze(source);
}

// Export all types and utilities for external use
export * from './types';
export * from './lexer/tokens';
export * from './lexer/lexer';
export * from './parser/parser';
export * from './analyzer/analyzer';
export * from './monarch/monarch-generator';

// Export LSP functionality
export * from './lsp';

// Example usage and testing
if (require.main === module) {
  console.log('Tempoest - Day Planning DSL Parser');
  console.log('==================================\n');
  
  const exampleSource = `- 9am, Clear inbox, 30m, :work::planning
- Tidy kitchen :home::cleaning
- 10:15, :work::meeting, Daily standup, 15m
- 11:00am 45m Deep work :work::focus
- !default duration=25m
- !policy overlaps=warning
- 12:30pm Lunch break, 1h, :personal`;

  try {
    console.log('Input:');
    console.log(exampleSource);
    console.log('\n' + '='.repeat(50) + '\n');
    
    const result = parseAndAnalyze(exampleSource, {
      today: '2025-01-15',
      timezone: 'America/Toronto'
    });
    
    console.log('Analysis Result:');
    console.log('Context:', JSON.stringify(result.context, null, 2));
    console.log('\nLines:');
    
    result.lines.forEach(line => {
      console.log(`\nLine ${line.lineNo} (${line.status}):`);
      console.log(`  Raw: "${line.raw}"`);
      
      if (line.diagnostics.length > 0) {
        console.log('  Diagnostics:');
        line.diagnostics.forEach(diag => {
          console.log(`    ${diag.code}: ${diag.message}`);
        });
      }
      
      if (line.node) {
        if (line.node.kind === 'task') {
          const task = line.node;
          console.log(`  Task: "${task.title}"`);
          console.log(`    Start: ${task.start} (explicit: ${task.explicitStart})`);
          console.log(`    Duration: ${task.durationMin}m (explicit: ${task.explicitDuration})`);
          console.log(`    End: ${task.end}`);
          if (task.categories.length > 0) {
            console.log(`    Categories: ${task.categories.map(c => c.segments.join('::'))}`);
          }
        } else if (line.node.kind === 'directive') {
          const directive = line.node;
          console.log(`  Directive: ${directive.name}`);
          console.log(`    Args: ${JSON.stringify(directive.args)}`);
        }
      }
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('\nSummary:');
    const validLines = result.lines.filter(l => l.status === 'valid').length;
    const warningLines = result.lines.filter(l => l.status === 'valid-with-warnings').length;
    const invalidLines = result.lines.filter(l => l.status === 'invalid').length;
    const totalDiagnostics = result.lines.reduce((sum, l) => sum + l.diagnostics.length, 0);
    
    console.log(`- Valid lines: ${validLines}`);
    console.log(`- Lines with warnings: ${warningLines}`);
    console.log(`- Invalid lines: ${invalidLines}`);
    console.log(`- Total diagnostics: ${totalDiagnostics}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}