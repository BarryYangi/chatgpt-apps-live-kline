type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

class Logger {
  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    // 输出 JSON 格式到标准输出
    console.log(JSON.stringify(entry));
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log("error", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log("debug", message, meta);
  }
}

export const logger = new Logger();

// 包装全局 console，使其输出 JSON 格式（仅在服务器端）
if (typeof process !== "undefined" && typeof window === "undefined") {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  const formatLog = (level: LogLevel, args: unknown[]) => {
    const message = args
      .map((arg) => {
        if (typeof arg === "object" && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(entry);
  };

  console.log = (...args: unknown[]) => {
    if (process.stdout && typeof process.stdout.write === "function") {
      try {
        process.stdout.write(formatLog("info", args) + "\n");
      } catch {
        originalLog(...args);
      }
    } else {
      originalLog(...args);
    }
  };

  console.warn = (...args: unknown[]) => {
    if (process.stdout && typeof process.stdout.write === "function") {
      try {
        process.stdout.write(formatLog("warn", args) + "\n");
      } catch {
        originalWarn(...args);
      }
    } else {
      originalWarn(...args);
    }
  };

  console.error = (...args: unknown[]) => {
    if (process.stderr && typeof process.stderr.write === "function") {
      try {
        process.stderr.write(formatLog("error", args) + "\n");
      } catch {
        originalError(...args);
      }
    } else {
      originalError(...args);
    }
  };

  console.debug = (...args: unknown[]) => {
    if (process.stdout && typeof process.stdout.write === "function") {
      try {
        process.stdout.write(formatLog("debug", args) + "\n");
      } catch {
        originalDebug(...args);
      }
    } else {
      originalDebug(...args);
    }
  };
}
