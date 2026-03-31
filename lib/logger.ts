// lib/logger.ts

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogEntry {
    level: LogLevel;
    message: string;
    traceId?: string;
    data?: unknown;
    timestamp: string;
}

function formatEntry(entry: LogEntry): string {
    const traceTag = entry.traceId ? ` [TraceID: ${entry.traceId}]` : "";
    const dataTag = entry.data ? ` | ${JSON.stringify(entry.data)}` : "";
    return `[${entry.timestamp}] [${entry.level}]${traceTag} ${entry.message}${dataTag}`;
}

function log(level: LogLevel, message: string, data?: unknown, traceId?: string) {
    const entry: LogEntry = {
        level,
        message,
        traceId,
        data,
        timestamp: new Date().toISOString(),
    };
    const formatted = formatEntry(entry);
    switch (level) {
        case "DEBUG": console.debug(formatted); break;
        case "INFO": console.info(formatted); break;
        case "WARN": console.warn(formatted); break;
        case "ERROR": console.error(formatted); break;
    }
}

export const logger = {
    debug: (message: string, data?: unknown, traceId?: string) => log("DEBUG", message, data, traceId),
    info: (message: string, data?: unknown, traceId?: string) => log("INFO", message, data, traceId),
    warn: (message: string, data?: unknown, traceId?: string) => log("WARN", message, data, traceId),
    error: (message: string, data?: unknown, traceId?: string) => log("ERROR", message, data, traceId),
};

export function generateTraceId(): string {
    return crypto.randomUUID().split("-")[0].toUpperCase();
}