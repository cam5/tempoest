/**
 * Utilities that leverage existing parser/analyzer logic to avoid duplication
 */

// Note: We reuse the parsing logic from analyzer without importing the class
import { tokenize } from '../lexer/lexer';
import { TimeClock, TimeWord, Duration } from '../lexer/tokens';

/**
 * Parse a time string using the same logic as the main analyzer
 * This ensures consistency with the main parsing pipeline
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  try {
    let hours = 0;
    let minutes = 0;
    
    if (timeStr.toLowerCase() === 'noon') {
      hours = 12;
    } else if (timeStr.toLowerCase() === 'midnight') {
      hours = 0;
    } else {
      const timeMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?(?:(am|pm))?$/i);
      if (!timeMatch) {
        return null;
      }
      
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2] || '0', 10);
      const ampm = timeMatch[3]?.toLowerCase();
      
      // Validate hours and minutes ranges
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }
      
      // For 12-hour format, validate hour range
      if (ampm && (hours < 1 || hours > 12)) {
        return null;
      }
      
      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
    }
    
    return { hours, minutes };
  } catch (error) {
    return null;
  }
}

/**
 * Find time tokens in a line using the existing Chevrotain lexer
 * This ensures we use the exact same token definitions as the parser
 */
export function findTimeTokenInLine(line: string): { 
  timeStr: string; 
  start: number; 
  end: number; 
  tokenType: 'TimeClock' | 'TimeWord';
} | null {
  try {
    const tokenizeResult = tokenize(line);
    
    // Look for time tokens (TimeClock or TimeWord)
    for (const token of tokenizeResult.tokens) {
      if (token.tokenType === TimeClock) {
        return {
          timeStr: token.image,
          start: token.startOffset!,
          end: token.endOffset! + 1,
          tokenType: 'TimeClock'
        };
      } else if (token.tokenType === TimeWord) {
        return {
          timeStr: token.image,
          start: token.startOffset!,
          end: token.endOffset! + 1,
          tokenType: 'TimeWord'
        };
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Find duration tokens in a line using the existing Chevrotain lexer
 */
export function findDurationTokenInLine(line: string): { 
  durationStr: string; 
  start: number; 
  end: number; 
} | null {
  try {
    const tokenizeResult = tokenize(line);
    
    for (const token of tokenizeResult.tokens) {
      if (token.tokenType === Duration) {
        return {
          durationStr: token.image,
          start: token.startOffset!,
          end: token.endOffset! + 1
        };
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Parse a duration string using the same logic as the main analyzer
 */
export function parseDurationString(durationStr: string): number | null {
  try {
    if (!durationStr || durationStr.trim() === '') {
      return null;
    }
    
    const match = durationStr.match(/^(?:(\d+)h)?(?:(\d+)m)?$/);
    if (!match) {
      return null;
    }
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    
    // Must have at least hours or minutes
    if (hours === 0 && minutes === 0) {
      return null;
    }
    
    return hours * 60 + minutes;
  } catch (error) {
    return null;
  }
}

/**
 * Validate that a line matches the expected task format using the lexer
 * This helps ensure we're working with properly formatted lines
 */
export function validateTaskLineFormat(line: string): { 
  valid: boolean; 
  hasDash: boolean; 
  hasTime: boolean; 
  hasDuration: boolean; 
} {
  try {
    const tokenizeResult = tokenize(line);
    
    let hasDash = false;
    let hasTime = false;
    let hasDuration = false;
    
    for (const token of tokenizeResult.tokens) {
      if (token.tokenType.name === 'Dash') {
        hasDash = true;
      } else if (token.tokenType === TimeClock || token.tokenType === TimeWord) {
        hasTime = true;
      } else if (token.tokenType === Duration) {
        hasDuration = true;
      }
    }
    
    return {
      valid: hasDash, // At minimum, must have a dash to be a task
      hasDash,
      hasTime,
      hasDuration
    };
  } catch (error) {
    return {
      valid: false,
      hasDash: false,
      hasTime: false,
      hasDuration: false
    };
  }
}
