
/**
 * Safe JSON parsing utilities with proper error handling
 */

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return defaultValue;
  }
}

/**
 * Safely parse JSON array
 */
export function safeJsonParseArray<T>(json: string, defaultValue: T[] = []): T[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch (error) {
    console.warn('Failed to parse JSON array:', error);
    return defaultValue;
  }
}

/**
 * Safely stringify with error handling
 */
export function safeJsonStringify(value: unknown, defaultValue: string = '{}'): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn('Failed to stringify JSON:', error);
    return defaultValue;
  }
}
