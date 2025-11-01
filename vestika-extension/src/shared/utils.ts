// Utility functions

/**
 * Clean HTML by removing script and style tags
 */
export function cleanHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove script, style, and noscript tags
  doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());

  // Remove inline event handlers
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.documentElement.outerHTML;
}

/**
 * Extract HTML using CSS selector
 */
export function extractBySelector(selector: string): string {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found for selector: ${selector}`);
  }
  return cleanHTML(element.outerHTML);
}

/**
 * Match URL pattern with wildcards
 */
export function matchURLPattern(url: string, pattern: string): boolean {
  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/\*/g, '.*') // Convert * to .*
    .replace(/\?/g, '.'); // Convert ? to .

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(url);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format confidence score to color
 */
export function confidenceToColor(score: number): string {
  if (score >= 0.8) return 'green';
  if (score >= 0.5) return 'yellow';
  return 'red';
}

/**
 * Logger utility for development mode
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory = 'API' | 'AUTH' | 'AUTOSYNC' | 'EXTRACTION' | 'BADGE' | 'GENERAL';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
}

class Logger {
  private isDevelopment: boolean = false;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = 100;
  private storageKey: string = 'dev_logs';

  constructor() {
    // Check if in development mode
    // Note: import.meta.env may not be available in all contexts
    try {
      this.isDevelopment = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
    } catch {
      this.isDevelopment = false;
    }
  }

  setDevMode(isDev: boolean) {
    this.isDevelopment = isDev;
  }

  private formatMessage(level: LogLevel, category: LogCategory, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${category}]`;
    return data ? `${prefix} ${message}` : `${prefix} ${message}`;
  }

  private log(level: LogLevel, category: LogCategory, message: string, data?: any) {
    if (!this.isDevelopment) return;

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data ? this.sanitizeData(data) : undefined
    };

    // Add to buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Save to storage (async, non-blocking)
    this.saveToStorage().catch(() => {});

    // Console output
    const formattedMessage = this.formatMessage(level, category, message, data);
    const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';

    if (data) {
      console[consoleMethod](formattedMessage, data);
    } else {
      console[consoleMethod](formattedMessage);
    }
  }

  private sanitizeData(data: any): any {
    if (!data) return data;

    // Clone to avoid modifying original
    const cloned = JSON.parse(JSON.stringify(data));

    // Redact sensitive fields
    const sensitiveKeys = ['token', 'password', 'authorization', 'bearer', 'apikey', 'api_key'];

    const redact = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          redact(obj[key]);
        }
      }
      return obj;
    };

    return redact(cloned);
  }

  private async saveToStorage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          [this.storageKey]: this.logBuffer
        });
      }
    } catch (error) {
      // Silently fail - storage is optional
    }
  }

  async getLogs(): Promise<LogEntry[]> {
    if (!this.isDevelopment) return [];

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(this.storageKey);
        return result[this.storageKey] || [];
      }
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
    }
    return this.logBuffer;
  }

  async clearLogs() {
    this.logBuffer = [];
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove(this.storageKey);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  debug(category: LogCategory, message: string, data?: any) {
    this.log('DEBUG', category, message, data);
  }

  info(category: LogCategory, message: string, data?: any) {
    this.log('INFO', category, message, data);
  }

  warn(category: LogCategory, message: string, data?: any) {
    this.log('WARN', category, message, data);
  }

  error(category: LogCategory, message: string, data?: any) {
    this.log('ERROR', category, message, data);
  }

  // API-specific logging helpers
  logApiRequest(endpoint: string, method: string, data?: any) {
    this.info('API', `${method} ${endpoint}`, { request: data });
  }

  logApiResponse(endpoint: string, method: string, duration: number, status: number, data?: any) {
    const message = `${method} ${endpoint} - ${status} (${duration}ms)`;
    if (status >= 400) {
      this.error('API', message, { response: data });
    } else {
      this.info('API', message, { response: data });
    }
  }

  // Autosync-specific logging helpers
  logAutoSyncTrigger(url: string, configName: string) {
    this.info('AUTOSYNC', `Triggered for ${configName}`, { url });
  }

  logAutoSyncComplete(configName: string, sessionId: string, duration: number) {
    this.info('AUTOSYNC', `Completed for ${configName} (${duration}ms)`, { sessionId });
  }

  logAutoSyncError(configName: string, error: string) {
    this.error('AUTOSYNC', `Failed for ${configName}`, { error });
  }

  // Badge-specific logging helpers
  logBadgeChange(text: string, color: string, reason: string, autoClearMs?: number) {
    this.info('BADGE', `Set to "${text}" (${color}) - ${reason}`, { autoClearMs });
  }
}

// Export singleton instance
export const logger = new Logger();
