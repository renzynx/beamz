import type { LogLevel } from "./types";

export class Logger {
  private logLevel: LogLevel;

  constructor(level: LogLevel = "info") {
    this.logLevel = level;
  }

  setLevel(level: LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.logLevel] ?? 1;
    return levels[level] >= currentLevel;
  }

  log(level: LogLevel, message: string, data?: any) {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      const logData = data ? ` - ${JSON.stringify(data)}` : "";
      console.log(
        `[${timestamp}] [${level.toUpperCase()}] ${message}${logData}`,
      );
    }
  }

  debug(message: string, data?: any) {
    this.log("debug", message, data);
  }

  info(message: string, data?: any) {
    this.log("info", message, data);
  }

  warn(message: string, data?: any) {
    this.log("warn", message, data);
  }

  error(message: string, data?: any) {
    this.log("error", message, data);
  }
}
