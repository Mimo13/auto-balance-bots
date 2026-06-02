import { appendFileSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Activity types for categorizing log entries. */
export type ActivityType =
  | 'system'
  | 'trade'
  | 'decision'
  | 'error'
  | 'cycle'
  | 'alert';

/** A single entry in the activity log. */
export interface ActivityEntry {
  id: number;
  timestamp: number; // Unix ms
  type: ActivityType;
  message: string;
  data?: Record<string, unknown>;
}

/** Filter for querying activity entries. */
export interface QueryFilter {
  type?: ActivityType;
  since?: number; // Unix ms, inclusive
  until?: number; // Unix ms, inclusive
  messageContains?: string;
}

/** Options for creating an ActivityLogger. */
export interface ActivityLoggerOptions {
  /** Path to the JSONL file. Defaults to ./data/activity.jsonl */
  filePath?: string;
}

const DEFAULT_LOG_PATH = './data/activity.jsonl';

/**
 * Append-only JSONL activity log.
 *
 * Each line is a JSON-serialized ActivityEntry. The file is created on first
 * write if it doesn't exist. Entries are assigned incrementing IDs persisted
 * in memory (nextId is derived from file content at construction).
 */
export class ActivityLogger {
  private readonly filePath: string;
  private nextId: number;

  constructor(options?: ActivityLoggerOptions) {
    this.filePath = options?.filePath ?? DEFAULT_LOG_PATH;
    this.nextId = this.computeNextId();
    this.ensureDir();
  }

  /**
   * Append a new entry to the JSONL file.
   * Returns the fully formed entry (with id and timestamp filled in).
   */
  log(entry: { type: ActivityType; message: string; data?: Record<string, unknown> }): ActivityEntry {
    const full: ActivityEntry = {
      id: this.nextId++,
      timestamp: Date.now(),
      type: entry.type,
      message: entry.message,
      data: entry.data,
    };

    appendFileSync(this.filePath, JSON.stringify(full) + '\n', 'utf-8');
    return full;
  }

  /**
   * Return the last `count` entries, most recent first.
   */
  getRecent(count: number): ActivityEntry[] {
    if (count <= 0) return [];
    const all = this.readAll();
    return all.reverse().slice(0, count);
  }

  /**
   * Query entries by filter criteria.
   * Returns entries in chronological order (oldest first).
   */
  query(filter: QueryFilter): ActivityEntry[] {
    const all = this.readAll();
    return all.filter((e) => {
      if (filter.type !== undefined && e.type !== filter.type) return false;
      if (filter.since !== undefined && e.timestamp < filter.since) return false;
      if (filter.until !== undefined && e.timestamp > filter.until) return false;
      if (filter.messageContains !== undefined && !e.message.includes(filter.messageContains)) return false;
      return true;
    });
  }

  /**
   * Clear the log file (truncate to empty).
   */
  clear(): void {
    writeFileSync(this.filePath, '', 'utf-8');
    this.nextId = 1;
  }

  /**
   * Close the logger. For the file-based implementation this is a no-op,
   * but the method exists for interface consistency and to release resources
   * in future implementations.
   */
  close(): void {
    // No-op for file-based implementation
  }

  private computeNextId(): number {
    if (!existsSync(this.filePath)) return 1;
    const lines = readFileSync(this.filePath, 'utf-8').trim().split('\n').filter(Boolean);
    if (lines.length === 0) return 1;
    const last = JSON.parse(lines[lines.length - 1]) as ActivityEntry;
    return last.id + 1;
  }

  private readAll(): ActivityEntry[] {
    if (!existsSync(this.filePath)) return [];
    const content = readFileSync(this.filePath, 'utf-8').trim();
    if (!content) return [];
    return content.split('\n').filter(Boolean).map((line) => JSON.parse(line) as ActivityEntry);
  }

  private ensureDir(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
