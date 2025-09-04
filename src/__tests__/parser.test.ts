import { tokenize } from '../lexer/lexer';
import { parser } from '../parser/parser';

describe('Day Plan Parser', () => {
  test('should parse basic task line', () => {
    const input = '- 9am, Clear inbox, 30m';
    const tokenResult = tokenize(input);
    
    parser.input = tokenResult.tokens;
    const cst = parser.program();
    
    expect(parser.errors).toHaveLength(0);
    expect(cst).toBeDefined();
    expect(cst.name).toBe('program');
  });
  
  test('should parse directive line', () => {
    const input = '- !default duration=25m';
    const tokenResult = tokenize(input);
    
    parser.input = tokenResult.tokens;
    const cst = parser.program();
    
    expect(parser.errors).toHaveLength(0);
    expect(cst).toBeDefined();
  });
  
  test('should parse task with categories', () => {
    const input = '- Work task :work::planning';
    const tokenResult = tokenize(input);
    
    parser.input = tokenResult.tokens;
    const cst = parser.program();
    
    expect(parser.errors).toHaveLength(0);
    expect(cst).toBeDefined();
  });
  
  test('should parse multiple lines', () => {
    const input = `- 9am Task A
- Task B
- !policy overlaps=error`;
    const tokenResult = tokenize(input);
    
    parser.input = tokenResult.tokens;
    const cst = parser.program();
    
    expect(parser.errors).toHaveLength(0);
    expect(cst).toBeDefined();
  });
  
  test('should parse task with comment', () => {
    const input = '- Task name # comment here';
    const tokenResult = tokenize(input);
    
    parser.input = tokenResult.tokens;
    const cst = parser.program();
    
    expect(parser.errors).toHaveLength(0);
    expect(cst).toBeDefined();
  });
  
  test('should handle blank lines', () => {
    const input = `
- Task A

- Task B
`;
    const tokenResult = tokenize(input);
    
    parser.input = tokenResult.tokens;
    const cst = parser.program();
    
    expect(parser.errors).toHaveLength(0);
    expect(cst).toBeDefined();
  });
  
  test('should parse comment-only lines', () => {
    const input = '# This is just a comment';
    const tokenResult = tokenize(input);
    
    parser.input = tokenResult.tokens;
    const cst = parser.program();
    
    expect(parser.errors).toHaveLength(0);
    expect(cst).toBeDefined();
  });
});
