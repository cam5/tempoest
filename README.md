# Tempoest

A TypeScript project implementing a Chevrotain-based parser and analyzer for a day-planning DSL. Parse, validate, and analyze line-oriented day plans with intelligent time inference, overlap detection, and comprehensive diagnostics.

## Features

- **Line-oriented DSL**: Simple, readable syntax for daily task planning
- **Intelligent Time Inference**: Automatically chains task start times
- **Comprehensive Validation**: Detailed error codes and warnings with precise location information
- **Flexible Configuration**: Directives for default duration, overlap policies, and timezone handling
- **Category Support**: Hierarchical categorization with `:root::sub::leaf` syntax
- **Tolerant Parsing**: Continues parsing despite minor formatting issues
- **TypeScript**: Full type safety with exhaustive diagnostic code checking
- **Monaco Editor Integration**: Export Monarch syntax definitions for Monaco Editor syntax highlighting

## DSL Syntax

### Basic Task Format

```
- [time], [title], [duration], [categories]  # comment
```

All parts except the leading dash are optional and order-independent:

```
- 9am, Clear inbox, 30m, :work::planning
- Tidy kitchen :home::cleaning
- 10:15, :work::meeting, Daily standup, 15m
- 11:00am 45m Deep work :work::focus
```

### Time Formats

- `9am`, `9:00am`, `09:15`, `21:00`
- `noon`, `midnight`
- If omitted, tasks start when the previous task ends

### Duration Formats

- `30m` (30 minutes)
- `1h` (1 hour)
- `1h30m` (1 hour 30 minutes)
- If omitted, uses default duration (30m, configurable)

### Categories

- `:work::planning` → `["work", "planning"]`
- `:home::cleaning` → `["home", "cleaning"]`
- Multiple categories supported per task

### Directives

Configure parsing behavior:

```
- !default duration=25m
- !policy overlaps=warning|error|ignore
- !day 2025-01-15
- !tz America/Toronto
```

### Comments

```
# Hash comments
// Slash comments
- Task name # inline comments
```

## API Usage

```typescript
import { parseAndAnalyze } from 'tempoest';

const dayPlan = `- 9am, Clear inbox, 30m, :work::planning
- Tidy kitchen :home::cleaning
- 10:15, Daily standup, 15m, :work::meeting`;

const result = parseAndAnalyze(dayPlan, {
  today: '2025-01-15',
  timezone: 'America/Toronto'
});

// Access parsed tasks
result.lines.forEach(line => {
  if (line.node?.kind === 'task') {
    const task = line.node;
    console.log(`${task.title}: ${task.start} - ${task.end}`);
    console.log(`Categories: ${task.categories.map(c => c.segments.join('::'))}`);
  }
});

// Check for diagnostics
const errors = result.lines.flatMap(line => 
  line.diagnostics.filter(d => d.code.startsWith('E'))
);
const warnings = result.lines.flatMap(line => 
  line.diagnostics.filter(d => d.code.startsWith('W'))
);
```

## Validation and Diagnostics

### Error Codes

- `E001-bad-time`: Invalid time format
- `E010-bad-duration`: Invalid duration format  
- `E020-missing-start-first-line`: First task must have explicit start time
- `E030-overlap`: Task overlap when policy is 'error'
- `E040-unknown-directive`: Unrecognized directive
- `E050-bad-category`: Invalid category format

### Warning Codes

- `W001-missing-space-after-dash`: `-Task` instead of `- Task`
- `W005-trailing-comma`: Unnecessary trailing comma
- `W010-overlap`: Task overlap when policy is 'warning' (default)
- `W020-ambiguous-time`: Ambiguous time format
- `W030-unknown-part`: Unrecognized token (becomes part of title)

## Project Structure

```
src/
├── types.ts           # TypeScript interfaces
├── lexer/
│   ├── tokens.ts      # Token definitions and preprocessing
│   └── lexer.ts       # Lexer implementation
├── parser/
│   └── parser.ts      # Chevrotain parser
├── analyzer/
│   └── analyzer.ts    # Analysis engine with inference and validation
├── examples/
│   └── basic-usage.ts # Usage examples
├── __tests__/
│   ├── lexer.test.ts
│   ├── parser.test.ts
│   ├── analyzer.test.ts
│   └── integration.test.ts
└── index.ts           # Main API
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Yarn

### Installation

```bash
# Install dependencies
yarn install

# Build the project
yarn build

# Run the example
yarn start

# Run in development mode
yarn dev

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch
```

### Development

```bash
# Watch for changes and rebuild
yarn watch

# Run specific example
npx ts-node src/examples/basic-usage.ts

# Clean build artifacts
yarn clean
```

## Example Output

Input:
```
- 9am, Clear inbox, 30m, :work::planning
- Tidy kitchen :home::cleaning
```

Output:
```json
{
  "context": {
    "day": "2025-01-15",
    "timezone": "America/Toronto", 
    "defaultDurationMin": 30,
    "overlapPolicy": "warning"
  },
  "lines": [
    {
      "raw": "- 9am, Clear inbox, 30m, :work::planning",
      "lineNo": 1,
      "status": "valid",
      "diagnostics": [],
      "node": {
        "kind": "task",
        "title": "Clear inbox",
        "start": "2025-01-15T09:00:00-04:00",
        "durationMin": 30,
        "end": "2025-01-15T09:30:00-04:00",
        "categories": [{"segments": ["work", "planning"]}],
        "explicitStart": true,
        "explicitDuration": true
      }
    },
    {
      "raw": "- Tidy kitchen :home::cleaning",
      "lineNo": 2,
      "status": "valid", 
      "diagnostics": [],
      "node": {
        "kind": "task",
        "title": "Tidy kitchen",
        "start": "2025-01-15T09:30:00-04:00",
        "durationMin": 30,
        "end": "2025-01-15T10:00:00-04:00",
        "categories": [{"segments": ["home", "cleaning"]}],
        "explicitStart": false,
        "explicitDuration": false
      }
    }
  ]
}
```

## Monaco Editor Integration

Tempoest can generate Monarch syntax definitions for Monaco Editor integration:

```typescript
import { generateMonarchExport } from 'tempoest';

// Generate Monarch language definition and theme
const { language, theme } = generateMonarchExport({
  includeTheme: true,
  themeName: 'light'  // or 'dark'
});

// Register with Monaco Editor
monaco.languages.register({ id: 'dayplan' });
monaco.languages.setMonarchTokensProvider('dayplan', language);
monaco.editor.defineTheme('dayplan-theme', theme);

// Use in your editor
monaco.editor.create(document.getElementById('container'), {
  value: '- 9am, Task, 30m, :work',
  language: 'dayplan',
  theme: 'dayplan-theme'
});
```

For JSON export (useful for non-TypeScript projects):

```typescript
import { generateSerializableMonarchExport } from 'tempoest';

const monarchDefinition = generateSerializableMonarchExport();
// Save to file or use directly
```

## Testing

The project includes comprehensive tests covering:

- **Lexer**: Token recognition and line preprocessing
- **Parser**: Grammar parsing and CST generation  
- **Analyzer**: Time inference, validation, and diagnostics
- **Integration**: End-to-end scenarios and edge cases
- **Monarch**: Syntax highlighting definition generation

Run tests with:
```bash
yarn test
```

## Architecture

Built with:

- [Chevrotain](https://chevrotain.io/) - Parser building toolkit
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Jest](https://jestjs.io/) - Testing framework
- [ESLint](https://eslint.org/) - Code linting

The architecture follows a clean separation:

1. **Lexer** tokenizes input with preprocessing for format tolerance
2. **Parser** builds a Concrete Syntax Tree using Chevrotain
3. **Analyzer** performs semantic analysis, inference, and validation
4. **Types** provide comprehensive TypeScript interfaces

## License

MIT License - see LICENSE file for details.