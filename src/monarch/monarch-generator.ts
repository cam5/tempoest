// Note: Token definitions are used directly rather than importing allTokens array

export interface MonarchLanguageDefinition {
  keywords: string[];
  operators: string[];
  symbols: RegExp;
  tokenizer: {
    root: Array<[RegExp | string, string | { cases?: Record<string, string>; next?: string; [key: string]: any }]>;
    [state: string]: Array<[RegExp | string, string | { cases?: Record<string, string>; next?: string; [key: string]: any }]>;
  };
}

export interface MonarchTheme {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  rules: Array<{
    token: string;
    foreground?: string;
    background?: string;
    fontStyle?: string;
  }>;
  colors?: Record<string, string>;
}

export interface MonarchExport {
  language: MonarchLanguageDefinition;
  theme?: MonarchTheme;
}

/**
 * Generates a Monarch language definition for the day-planning DSL
 */
export class MonarchGenerator {
  /**
   * Generate the complete Monarch language definition
   */
  generateLanguageDefinition(): MonarchLanguageDefinition {
    return {
      // Keywords for directives and time words
      keywords: [
        'default', 'policy', 'day', 'tz',  // directive names
        'scratchpad', 'planner',           // section directives
        'noon', 'midnight',               // time words
        'warning', 'error', 'ignore',     // policy values
      ],

      // Operators and structural symbols
      operators: [
        '=', ',', ':', '::', '-', '!',
      ],

      // Symbol pattern for operators
      symbols: /[=,:!\-]+/,

      tokenizer: {
        root: [
          // Comments - handle first to avoid conflicts
          [/#.*$/, 'comment'],
          [/\/\/.*$/, 'comment'],

          // Whitespace
          [/\s+/, ''],

          // Line starters
          [/^(\s*)-/, { token: 'keyword.task-marker', next: '@task_line' }],
          [/^(\s*)!scratchpad\b/, { token: 'keyword.section-directive', next: '@pop' }],
          [/^(\s*)!planner\b/, { token: 'keyword.section-directive', next: '@pop' }],
          [/^(\s*)!/, { token: 'keyword.directive-marker', next: '@directive_line' }],

          // Fallback for any other content
          [/.*/, 'text'],
        ],

        task_line: [
          // Comments can appear anywhere in task lines
          [/#.*$/, { token: 'comment', next: '@pop' }],
          [/\/\/.*$/, { token: 'comment', next: '@pop' }],

          // Time patterns (order matters - most specific first)
          [/\b(?:noon|midnight)\b/i, 'constant.time-word'],
          [/\b\d{1,2}:\d{2}(?:am|pm)?\b/i, 'constant.time'],
          [/\b\d{1,2}(?:am|pm)\b/i, 'constant.time'],

          // Duration patterns
          [/\b\d+h(?:\d{1,2}m)?\b/, 'constant.duration'],
          [/\b\d+m\b/, 'constant.duration'],

          // Categories - handle :: before : to avoid conflicts
          [/::/, 'keyword.category-separator'],
          [/:/, { token: 'keyword.category-start', next: '@category' }],

          // Structural elements
          [/,/, 'punctuation.comma'],
          [/=/, 'operator'],

          // End of line
          [/$/, { token: '', next: '@pop' }],

          // Task title text (anything else)
          [/[^\s,:=#\/]+/, 'string.task-title'],
          [/\s+/, ''],
        ],

        directive_line: [
          // Comments
          [/#.*$/, { token: 'comment', next: '@pop' }],
          [/\/\/.*$/, { token: 'comment', next: '@pop' }],

          // Directive names
          [/\b(?:default|policy|day|tz|scratchpad|planner)\b/, 'keyword.directive-name'],

          // Directive arguments
          [/=/, 'operator'],
          [/\b(?:warning|error|ignore)\b/, 'constant.policy-value'],
          [/\b\d+m?\b/, 'constant.duration'],
          [/\b\d{4}-\d{2}-\d{2}\b/, 'constant.date'],
          [/[A-Za-z][A-Za-z0-9_\/]*/, 'string.directive-value'],

          // Structural
          [/,/, 'punctuation.comma'],

          // End of line
          [/$/, { token: '', next: '@pop' }],

          // Whitespace
          [/\s+/, ''],
        ],

        category: [
          // Category segments
          [/[A-Za-z0-9_-]+/, 'entity.name.category'],
          [/::/, 'keyword.category-separator'],
          [/:/, { token: 'keyword.category-end', next: '@pop' }],

          // End category on comma, space, or end of line
          [/(?=[,\s]|$)/, { token: '', next: '@pop' }],
        ],
      },
    };
  }

  /**
   * Generate a default theme for the day-planning DSL
   */
  generateDefaultTheme(): MonarchTheme {
    return {
      base: 'vs',
      inherit: false,
      rules: [
        // Task and directive markers
        { token: 'keyword.task-marker', foreground: '0066CC', fontStyle: 'bold' },
        { token: 'keyword.directive-marker', foreground: 'CC6600', fontStyle: 'bold' },
        { token: 'keyword.section-directive', foreground: 'AA00AA', fontStyle: 'bold' },

        // Time and duration
        { token: 'constant.time', foreground: '0066CC' },
        { token: 'constant.time-word', foreground: '0066CC', fontStyle: 'italic' },
        { token: 'constant.duration', foreground: '6600CC' },
        { token: 'constant.date', foreground: '0066CC' },

        // Categories
        { token: 'keyword.category-start', foreground: 'CC0066' },
        { token: 'keyword.category-separator', foreground: 'CC0066' },
        { token: 'keyword.category-end', foreground: 'CC0066' },
        { token: 'entity.name.category', foreground: 'CC0066', fontStyle: 'italic' },

        // Directives
        { token: 'keyword.directive-name', foreground: 'CC6600', fontStyle: 'bold' },
        { token: 'constant.policy-value', foreground: '009900' },
        { token: 'string.directive-value', foreground: '666666' },

        // Task content
        { token: 'string.task-title', foreground: '333333' },

        // Comments
        { token: 'comment', foreground: '999999', fontStyle: 'italic' },

        // Punctuation
        { token: 'punctuation.comma', foreground: '666666' },
        { token: 'operator', foreground: '666666' },
      ],
    };
  }

  /**
   * Generate a dark theme variant
   */
  generateDarkTheme(): MonarchTheme {
    return {
      base: 'vs-dark',
      inherit: false,
      rules: [
        // Task and directive markers
        { token: 'keyword.task-marker', foreground: '4FC3F7', fontStyle: 'bold' },
        { token: 'keyword.directive-marker', foreground: 'FFB74D', fontStyle: 'bold' },
        { token: 'keyword.section-directive', foreground: 'CE93D8', fontStyle: 'bold' },

        // Time and duration
        { token: 'constant.time', foreground: '4FC3F7' },
        { token: 'constant.time-word', foreground: '4FC3F7', fontStyle: 'italic' },
        { token: 'constant.duration', foreground: 'BA68C8' },
        { token: 'constant.date', foreground: '4FC3F7' },

        // Categories
        { token: 'keyword.category-start', foreground: 'F48FB1' },
        { token: 'keyword.category-separator', foreground: 'F48FB1' },
        { token: 'keyword.category-end', foreground: 'F48FB1' },
        { token: 'entity.name.category', foreground: 'F48FB1', fontStyle: 'italic' },

        // Directives
        { token: 'keyword.directive-name', foreground: 'FFB74D', fontStyle: 'bold' },
        { token: 'constant.policy-value', foreground: '81C784' },
        { token: 'string.directive-value', foreground: 'BDBDBD' },

        // Task content
        { token: 'string.task-title', foreground: 'E0E0E0' },

        // Comments
        { token: 'comment', foreground: '757575', fontStyle: 'italic' },

        // Punctuation
        { token: 'punctuation.comma', foreground: 'BDBDBD' },
        { token: 'operator', foreground: 'BDBDBD' },
      ],
    };
  }

  /**
   * Generate the complete export object with language and themes
   */
  generateMonarchExport(includeTheme: boolean = true, themeName: 'light' | 'dark' = 'light'): MonarchExport {
    const result: MonarchExport = {
      language: this.generateLanguageDefinition(),
    };

    if (includeTheme) {
      result.theme = themeName === 'dark' 
        ? this.generateDarkTheme() 
        : this.generateDefaultTheme();
    }

    return result;
  }

}

/**
 * Convenience function to generate Monarch export
 */
export function generateMonarchExport(options: {
  includeTheme?: boolean;
  themeName?: 'light' | 'dark';
} = {}): MonarchExport {
  const generator = new MonarchGenerator();
  return generator.generateMonarchExport(
    options.includeTheme ?? true,
    options.themeName ?? 'light'
  );
}

/**
 * Generate a serializable version of the Monarch export (for JSON export)
 * This handles RegExp objects properly by converting them to strings
 */
export function generateSerializableMonarchExport(options: {
  includeTheme?: boolean;
  themeName?: 'light' | 'dark';
} = {}): any {
  const monarchExport = generateMonarchExport(options);
  
  // Custom serializer to handle RegExp objects
  return JSON.parse(JSON.stringify(monarchExport, (key, value) => {
    if (value instanceof RegExp) {
      return value.toString();
    }
    return value;
  }));
}

