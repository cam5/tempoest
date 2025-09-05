import {
  MonarchGenerator,
  generateMonarchExport,
  MonarchLanguageDefinition,
  MonarchTheme,
} from '../monarch/monarch-generator';

describe('MonarchGenerator', () => {
  let generator: MonarchGenerator;

  beforeEach(() => {
    generator = new MonarchGenerator();
  });

  describe('generateLanguageDefinition', () => {
    it('should generate a valid Monarch language definition', () => {
      const definition = generator.generateLanguageDefinition();

      expect(definition).toBeDefined();
      expect(definition.keywords).toBeInstanceOf(Array);
      expect(definition.operators).toBeInstanceOf(Array);
      expect(definition.symbols).toBeInstanceOf(RegExp);
      expect(definition.tokenizer).toBeDefined();
      expect(definition.tokenizer.root).toBeInstanceOf(Array);
    });

    it('should include DSL-specific keywords', () => {
      const definition = generator.generateLanguageDefinition();

      expect(definition.keywords).toContain('default');
      expect(definition.keywords).toContain('policy');
      expect(definition.keywords).toContain('noon');
      expect(definition.keywords).toContain('midnight');
      expect(definition.keywords).toContain('warning');
      expect(definition.keywords).toContain('error');
      expect(definition.keywords).toContain('ignore');
    });

    it('should include DSL-specific operators', () => {
      const definition = generator.generateLanguageDefinition();

      expect(definition.operators).toContain('-');
      expect(definition.operators).toContain('!');
      expect(definition.operators).toContain(':');
      expect(definition.operators).toContain('::');
      expect(definition.operators).toContain('=');
      expect(definition.operators).toContain(',');
    });

    it('should have tokenizer states for different line types', () => {
      const definition = generator.generateLanguageDefinition();

      expect(definition.tokenizer.root).toBeDefined();
      expect(definition.tokenizer.task_line).toBeDefined();
      expect(definition.tokenizer.directive_line).toBeDefined();
      expect(definition.tokenizer.category).toBeDefined();
    });
  });

  describe('generateDefaultTheme', () => {
    it('should generate a valid light theme', () => {
      const theme = generator.generateDefaultTheme();

      expect(theme).toBeDefined();
      expect(theme.base).toBe('vs');
      expect(theme.inherit).toBe(false);
      expect(theme.rules).toBeInstanceOf(Array);
      expect(theme.rules.length).toBeGreaterThan(0);
    });

    it('should include theme rules for all token types', () => {
      const theme = generator.generateDefaultTheme();
      const tokenTypes = theme.rules.map(rule => rule.token);

      expect(tokenTypes).toContain('keyword.task-marker');
      expect(tokenTypes).toContain('keyword.directive-marker');
      expect(tokenTypes).toContain('constant.time');
      expect(tokenTypes).toContain('constant.duration');
      expect(tokenTypes).toContain('entity.name.category');
      expect(tokenTypes).toContain('comment');
    });
  });

  describe('generateDarkTheme', () => {
    it('should generate a valid dark theme', () => {
      const theme = generator.generateDarkTheme();

      expect(theme).toBeDefined();
      expect(theme.base).toBe('vs-dark');
      expect(theme.inherit).toBe(false);
      expect(theme.rules).toBeInstanceOf(Array);
      expect(theme.rules.length).toBeGreaterThan(0);
    });

    it('should use different colors than light theme', () => {
      const lightTheme = generator.generateDefaultTheme();
      const darkTheme = generator.generateDarkTheme();

      // Find task marker rules in both themes
      const lightTaskMarker = lightTheme.rules.find(r => r.token === 'keyword.task-marker');
      const darkTaskMarker = darkTheme.rules.find(r => r.token === 'keyword.task-marker');

      expect(lightTaskMarker?.foreground).not.toBe(darkTaskMarker?.foreground);
    });
  });

  describe('generateMonarchExport', () => {
    it('should generate export with language definition only', () => {
      const monarchExport = generator.generateMonarchExport(false);

      expect(monarchExport.language).toBeDefined();
      expect(monarchExport.theme).toBeUndefined();
    });

    it('should generate export with light theme', () => {
      const monarchExport = generator.generateMonarchExport(true, 'light');

      expect(monarchExport.language).toBeDefined();
      expect(monarchExport.theme).toBeDefined();
      expect(monarchExport.theme!.base).toBe('vs');
    });

    it('should generate export with dark theme', () => {
      const monarchExport = generator.generateMonarchExport(true, 'dark');

      expect(monarchExport.language).toBeDefined();
      expect(monarchExport.theme).toBeDefined();
      expect(monarchExport.theme!.base).toBe('vs-dark');
    });
  });

});

describe('Convenience functions', () => {
  describe('generateMonarchExport', () => {
    it('should generate export with default options', () => {
      const monarchExport = generateMonarchExport();

      expect(monarchExport.language).toBeDefined();
      expect(monarchExport.theme).toBeDefined();
      expect(monarchExport.theme!.base).toBe('vs');
    });

    it('should respect custom options', () => {
      const monarchExport = generateMonarchExport({
        includeTheme: true,
        themeName: 'dark',
      });

      expect(monarchExport.language).toBeDefined();
      expect(monarchExport.theme).toBeDefined();
      expect(monarchExport.theme!.base).toBe('vs-dark');
    });
  });

});

describe('Language definition validation', () => {
  it('should handle task lines correctly', () => {
    const definition = generateMonarchExport().language;
    
    // Check that task line tokenizer exists and has expected patterns
    expect(definition.tokenizer.task_line).toBeDefined();
    
    const taskLineRules = definition.tokenizer.task_line;
    const patterns = taskLineRules.map(rule => rule[0]);
    
    // Should have time patterns
    expect(patterns.some(p => p.toString().includes('noon|midnight'))).toBe(true);
    expect(patterns.some(p => p.toString().includes('\\d{1,2}:\\d{2}'))).toBe(true);
    
    // Should have duration patterns
    expect(patterns.some(p => p.toString().includes('\\d+h'))).toBe(true);
    expect(patterns.some(p => p.toString().includes('\\d+m'))).toBe(true);
    
    // Should have category patterns
    expect(patterns.some(p => p.toString().includes('::'))).toBe(true);
  });

  it('should handle directive lines correctly', () => {
    const definition = generateMonarchExport().language;
    
    expect(definition.tokenizer.directive_line).toBeDefined();
    
    const directiveLineRules = definition.tokenizer.directive_line;
    const patterns = directiveLineRules.map(rule => rule[0]);
    
    // Should have directive name patterns
    expect(patterns.some(p => p.toString().includes('default|policy|day|tz'))).toBe(true);
    
    // Should have policy value patterns
    expect(patterns.some(p => p.toString().includes('warning|error|ignore'))).toBe(true);
  });

  it('should handle comments correctly', () => {
    const definition = generateMonarchExport().language;
    
    // Comments should be handled in root and other states
    const rootRules = definition.tokenizer.root;
    const hasHashComment = rootRules.some(rule => 
      rule[0].toString().includes('#') && (
        rule[1] === 'comment' || 
        (typeof rule[1] === 'object' && rule[1].token === 'comment')
      )
    );
    const hasSlashComment = rootRules.some(rule => 
      rule[0].toString().includes('\\/\\/') && (
        rule[1] === 'comment' || 
        (typeof rule[1] === 'object' && rule[1].token === 'comment')
      )
    );
    
    expect(hasHashComment).toBe(true);
    expect(hasSlashComment).toBe(true);
  });
});
