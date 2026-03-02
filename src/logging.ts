/**
 * Logging utility — writes exclusively to stderr (MCP stdio requirement).
 * stdout must contain only JSON-RPC messages.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function fmt(level: LogLevel, msg: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
}

export const log = {
  debug: (msg: string) => shouldLog("debug") && process.stderr.write(fmt("debug", msg) + "\n"),
  info:  (msg: string) => shouldLog("info")  && process.stderr.write(fmt("info", msg) + "\n"),
  warn:  (msg: string) => shouldLog("warn")  && process.stderr.write(fmt("warn", msg) + "\n"),
  error: (msg: string) => shouldLog("error") && process.stderr.write(fmt("error", msg) + "\n"),
};
