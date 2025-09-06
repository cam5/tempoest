/**
 * Section Directives Demo
 * 
 * This example demonstrates the new section directive functionality:
 * - !scratchpad: Disables task parsing for note-taking and drafting
 * - !planner: Re-enables task parsing (default mode)
 * 
 * This is particularly useful for embedded UIs and LLM interactions where
 * users need a safe space to think and draft without affecting parsed output.
 */

import { parseAndAnalyze } from '../index';

// Example 1: Basic scratchpad usage
const basicExample = `- 9am Morning standup, 15m :work::meetings
- 9:15am Code review, 45m :work::development

!scratchpad
- Maybe add a task for lunch?
- Need to remember to call mom
- 2pm meeting with client (not sure if confirmed)
- Random thoughts and notes here
- 45m on cheese research (just kidding)

!planner
- 2pm Client meeting, 1h :work::meetings
- 3pm Focus time, 2h :work::development`;

console.log('=== Basic Scratchpad Example ===');
const basicResult = parseAndAnalyze(basicExample);

console.log('Parsed tasks:');
basicResult.lines.forEach((line, index) => {
  if (line.node?.kind === 'task') {
    const task = line.node as any;
    console.log(`  ${index + 1}. ${task.title} (${task.durationMin}m)`);
  } else if (line.node?.kind === 'directive') {
    const directive = line.node as any;
    console.log(`  ${index + 1}. [DIRECTIVE: ${directive.name}]`);
  } else if (line.raw.trim().startsWith('-') && !line.raw.trim().startsWith('- !')) {
    console.log(`  ${index + 1}. [SCRATCHPAD: ${line.raw.trim()}]`);
  }
});

console.log('\n');

// Example 2: Multiple section switches
const multiSectionExample = `- 8am Morning routine, 30m :personal

!scratchpad
- Ideas for today:
  - Maybe work on the presentation
  - Call the dentist
  - Buy groceries

!planner
- 9am Work block 1, 2h :work::development
- 11am Break, 15m

!scratchpad
- Notes from work block:
  - Fixed the bug in authentication
  - Need to refactor the user service
  - Consider using Redis for caching

!planner
- 11:15am Work block 2, 1h30m :work::development
- 12:45pm Lunch, 45m :personal`;

console.log('=== Multiple Section Switches Example ===');
const multiResult = parseAndAnalyze(multiSectionExample);

console.log('Parsed tasks:');
multiResult.lines.forEach((line, index) => {
  if (line.node?.kind === 'task') {
    const task = line.node as any;
    console.log(`  ${index + 1}. ${task.title} (${task.durationMin}m)`);
  } else if (line.node?.kind === 'directive') {
    const directive = line.node as any;
    console.log(`  ${index + 1}. [DIRECTIVE: ${directive.name}]`);
  }
});

console.log('\n');

// Example 3: Scratchpad with time-like content (should not be parsed)
const timeLikeExample = `- 9am Real morning task, 30m

!scratchpad
- 10am This looks like a task but isn't parsed, 45m :fake
- Another line with 2h duration that won't become a task
- :category::subcategory this won't be parsed either
- Maybe schedule 3pm meeting with boss?

!planner
- 10am Actual task after scratchpad, 1h :work`;

console.log('=== Time-like Content in Scratchpad Example ===');
const timeLikeResult = parseAndAnalyze(timeLikeExample);

console.log('Parsed tasks (note how scratchpad content is ignored):');
timeLikeResult.lines.forEach((line, index) => {
  if (line.node?.kind === 'task') {
    const task = line.node as any;
    console.log(`  ${index + 1}. ${task.title} (${task.durationMin}m)`);
  } else if (line.node?.kind === 'directive') {
    const directive = line.node as any;
    console.log(`  ${index + 1}. [DIRECTIVE: ${directive.name}]`);
  } else if (line.raw.trim().startsWith('-') && !line.raw.trim().startsWith('- !')) {
    console.log(`  ${index + 1}. [IGNORED: ${line.raw.trim()}]`);
  }
});

console.log('\n');

// Example 4: Mixed with other directives
const mixedDirectivesExample = `- !default duration=45m
- !policy overlaps=ignore

- 9am First task :work
- Second task (inherits 45m default)

!scratchpad
- Some notes here
- Maybe change the default duration?
- Test overlap policy

!planner
- 10:30am Third task, 30m :work
- Fourth task (back to 45m default)`;

console.log('=== Mixed with Other Directives Example ===');
const mixedResult = parseAndAnalyze(mixedDirectivesExample);

console.log(`Context - Default duration: ${mixedResult.context.defaultDurationMin}m`);
console.log(`Context - Overlap policy: ${mixedResult.context.overlapPolicy}`);

console.log('Parsed tasks:');
mixedResult.lines.forEach((line, index) => {
  if (line.node?.kind === 'task') {
    const task = line.node as any;
    console.log(`  ${index + 1}. ${task.title} (${task.durationMin}m, explicit: ${task.explicitDuration})`);
  } else if (line.node?.kind === 'directive') {
    const directive = line.node as any;
    if (directive.name === 'scratchpad' || directive.name === 'planner') {
      console.log(`  ${index + 1}. [SECTION: ${directive.name}]`);
    } else {
      console.log(`  ${index + 1}. [DIRECTIVE: ${directive.name}]`);
    }
  }
});

console.log('\n=== Summary ===');
console.log('Section directives provide a clean way to:');
console.log('1. Create scratchpad areas for notes and drafts');
console.log('2. Prevent accidental task parsing in note sections');
console.log('3. Enable safe experimentation with task syntax');
console.log('4. Support embedded UI workflows where users draft content');
console.log('5. Allow LLMs to work with mixed content safely');
