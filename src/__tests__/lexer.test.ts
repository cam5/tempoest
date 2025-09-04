import { tokenize } from '../lexer/lexer';
import { preprocessLine } from '../lexer/tokens';

describe('Day Plan Lexer', () => {
  describe('tokenization', () => {
    test('should tokenize basic task line', () => {
      const input = '- 9am, Clear inbox, 30m, :work::planning';
      const result = tokenize(input);
      
      expect(result.errors).toHaveLength(0);
      expect(result.tokens.length).toBeGreaterThan(0);
      
      // Check that we have the expected token types
      const tokenTypes = result.tokens.map(t => t.tokenType.name);
      expect(tokenTypes).toContain('Dash');
      expect(tokenTypes).toContain('TimeClock');
      expect(tokenTypes).toContain('Duration');
      expect(tokenTypes).toContain('CategoryColon');
    });
    
    test('should tokenize directive line', () => {
      const input = '- !default duration=25m';
      const result = tokenize(input);
      
      expect(result.errors).toHaveLength(0);
      const tokenTypes = result.tokens.map(t => t.tokenType.name);
      expect(tokenTypes).toContain('Dash');
      expect(tokenTypes).toContain('Bang');
      expect(tokenTypes).toContain('Identifier');
      expect(tokenTypes).toContain('Equals');
      expect(tokenTypes).toContain('Duration');
    });
    
    test('should handle comments', () => {
      const input = '- Task name # this is a comment';
      const result = tokenize(input);
      
      expect(result.errors).toHaveLength(0);
      const tokenTypes = result.tokens.map(t => t.tokenType.name);
      expect(tokenTypes).toContain('HashComment');
    });
    
    test('should handle time words', () => {
      const input = '- noon, Lunch break';
      const result = tokenize(input);
      
      expect(result.errors).toHaveLength(0);
      const tokenTypes = result.tokens.map(t => t.tokenType.name);
      expect(tokenTypes).toContain('TimeWord');
    });
  });
  
  describe('line preprocessing', () => {
    test('should detect proper dash spacing', () => {
      const result = preprocessLine('- Task name', 1);
      
      expect(result.hasSpaceAfterDash).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.processedLine).toBe('- Task name');
    });
    
    test('should detect missing space after dash', () => {
      const result = preprocessLine('-Task name', 1);
      
      expect(result.hasSpaceAfterDash).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe('W001-missing-space-after-dash');
      expect(result.processedLine).toBe('- Task name'); // Should inject space
    });
    
    test('should handle non-dash lines', () => {
      const result = preprocessLine('Just a comment', 1);
      
      expect(result.hasSpaceAfterDash).toBe(true); // N/A for non-dash lines
      expect(result.diagnostics).toHaveLength(0);
      expect(result.processedLine).toBe('Just a comment');
    });
    
    test('should handle dash with only whitespace after', () => {
      const result = preprocessLine('-   ', 1);
      
      expect(result.hasSpaceAfterDash).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });
});
