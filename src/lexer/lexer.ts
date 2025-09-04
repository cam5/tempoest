import { Lexer } from 'chevrotain';
import { allTokens, preprocessLine, LinePreprocessResult } from './tokens';

// Create the lexer instance
export const lexer = new Lexer(allTokens);

export interface TokenizeResult {
  tokens: any[];
  errors: any[];
  preprocessResults: LinePreprocessResult[];
}

export function tokenizeLines(lines: string[]): TokenizeResult {
  const preprocessResults: LinePreprocessResult[] = [];
  const allTokens: any[] = [];
  const allErrors: any[] = [];
  
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    
    // Preprocess the line for dash-space detection
    const preprocessResult = preprocessLine(line, lineNo);
    preprocessResults.push(preprocessResult);
    
    // Tokenize the (possibly modified) line
    const lexingResult = lexer.tokenize(preprocessResult.processedLine);
    
    // Add line number info to tokens
    lexingResult.tokens.forEach(token => {
      (token as any).lineNo = lineNo;
    });
    
    allTokens.push(...lexingResult.tokens);
    allErrors.push(...lexingResult.errors);
  });
  
  return {
    tokens: allTokens,
    errors: allErrors,
    preprocessResults,
  };
}

export function tokenize(text: string): TokenizeResult {
  const lines = text.split(/\r?\n/);
  return tokenizeLines(lines);
}