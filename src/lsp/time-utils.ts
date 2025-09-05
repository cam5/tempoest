/**
 * Time manipulation utilities for LSP commands
 */

export interface TimeOffset {
  hours: number;
  minutes: number;
  sign: 1 | -1;
}

export interface TimeShiftResult {
  success: boolean;
  newTime?: string;
  error?: string;
}

/**
 * Parse time offset strings like "+10m", "-1h30m", "+2h"
 */
export function parseTimeOffset(offset: string): TimeOffset | null {
  const match = offset.match(/^([+-])(?:(\d+)h)?(?:(\d+)m)?$/);
  if (!match) return null;
  
  const [, sign, hoursStr, minutesStr] = match;
  const hours = parseInt(hoursStr || '0', 10);
  const minutes = parseInt(minutesStr || '0', 10);
  
  if (hours === 0 && minutes === 0) return null;
  
  return {
    hours,
    minutes,
    sign: sign === '+' ? 1 : -1
  };
}

/**
 * Apply time offset to an ISO datetime string
 */
export function applyTimeOffset(isoTime: string, offset: TimeOffset): string {
  const date = new Date(isoTime);
  const totalMinutes = (offset.hours * 60 + offset.minutes) * offset.sign;
  
  date.setMinutes(date.getMinutes() + totalMinutes);
  return date.toISOString();
}

/**
 * Apply time offset to a time string like "9am", "10:30"
 */
export function applyTimeOffsetToTimeString(timeStr: string, offset: TimeOffset): TimeShiftResult {
  try {
    // Parse the time string to get hours/minutes
    const parsed = parseTimeString(timeStr);
    if (!parsed.success) {
      return { success: false, error: `Invalid time format: ${timeStr}` };
    }
    
    // Apply offset
    let newHours = parsed.hours!;
    let newMinutes = parsed.minutes!;
    const totalMinutes = (offset.hours * 60 + offset.minutes) * offset.sign;
    
    newMinutes += totalMinutes;
    
    // Handle minute overflow/underflow
    while (newMinutes >= 60) {
      newMinutes -= 60;
      newHours += 1;
    }
    while (newMinutes < 0) {
      newMinutes += 60;
      newHours -= 1;
    }
    
    // Handle hour overflow/underflow (24-hour cycle)
    newHours = ((newHours % 24) + 24) % 24;
    
    // Format back to string, preserving original format style
    const newTimeStr = formatTimeString(newHours, newMinutes, parsed.format || 'clock12');
    
    return { success: true, newTime: newTimeStr };
  } catch (error) {
    return { success: false, error: `Error shifting time: ${error}` };
  }
}

interface ParsedTime {
  success: boolean;
  hours?: number;
  minutes?: number;
  format?: 'clock12' | 'clock24' | 'word';
}

/**
 * Parse various time formats: "9am", "9:30pm", "14:30", "noon", "midnight"
 */
function parseTimeString(timeStr: string): ParsedTime {
  const lower = timeStr.toLowerCase().trim();
  
  // Handle special words
  if (lower === 'noon') {
    return { success: true, hours: 12, minutes: 0, format: 'word' };
  }
  if (lower === 'midnight') {
    return { success: true, hours: 0, minutes: 0, format: 'word' };
  }
  
  // Handle 12-hour format with am/pm
  const ampmMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2] || '0', 10);
    const ampm = ampmMatch[3];
    
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    return { success: true, hours, minutes, format: 'clock12' };
  }
  
  // Handle 24-hour format
  const clockMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (clockMatch) {
    const hours = parseInt(clockMatch[1], 10);
    const minutes = parseInt(clockMatch[2], 10);
    
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { success: true, hours, minutes, format: 'clock24' };
    }
  }
  
  return { success: false };
}

/**
 * Format hours/minutes back to string, preserving original style
 */
function formatTimeString(hours: number, minutes: number, format: 'clock12' | 'clock24' | 'word'): string {
  // Handle special cases first
  if (hours === 12 && minutes === 0 && format === 'word') return 'noon';
  if (hours === 0 && minutes === 0 && format === 'word') return 'midnight';
  
  if (format === 'clock24') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  if (format === 'clock12') {
    let displayHours = hours;
    const ampm = hours >= 12 ? 'pm' : 'am';
    
    if (displayHours === 0) displayHours = 12;
    if (displayHours > 12) displayHours -= 12;
    
    if (minutes === 0) {
      return `${displayHours}${ampm}`;
    } else {
      return `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`;
    }
  }
  
  // Fallback to 12-hour format
  return formatTimeString(hours, minutes, 'clock12');
}

/**
 * Validate that a time offset string is valid
 */
export function validateTimeOffset(offset: string): { valid: boolean; error?: string } {
  if (!offset.trim()) {
    return { valid: false, error: 'Offset cannot be empty' };
  }
  
  const parsed = parseTimeOffset(offset);
  if (!parsed) {
    return { 
      valid: false, 
      error: 'Invalid offset format. Use +/-[Nh][Nm] (e.g., +10m, -1h30m, +2h)' 
    };
  }
  
  // Reasonable bounds check
  const totalMinutes = parsed.hours * 60 + parsed.minutes;
  if (totalMinutes > 12 * 60) { // More than 12 hours
    return { 
      valid: false, 
      error: 'Offset too large (max 12 hours)' 
    };
  }
  
  return { valid: true };
}
