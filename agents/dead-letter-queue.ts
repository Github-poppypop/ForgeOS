/**
 * agents/dead-letter-queue.ts — Dead-letter queue for failed agent tasks
 *
 * Failed tasks are persisted to JSON for later inspection / retry.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

export interface DeadLetterEntry {
  id: string;
  ts: string;
  agentId: string;
  role: string;
  missionId?: string;
  action: string;
  error: string;
  input?: unknown;
  result?: unknown;
}

export class DeadLetterQueue {
  private path: string;
  private entries: DeadLetterEntry[] = [];

  constructor(private readonly defaultPath: string = '/c/Projects/ForgeOS/data/dead-letter.json') {
    this.path = defaultPath;
    this.load();
  }

  setPath(path: string): void {
    this.path = path;
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.path)) {
        const raw = readFileSync(this.path, 'utf8');
        this.entries = JSON.parse(raw);
        if (!Array.isArray(this.entries)) this.entries = [];
      } else {
        this.entries = [];
      }
    } catch {
      this.entries = [];
    }
  }

  private persist(): void {
    try {
      const dir = this.path.split('/').slice(0, -1).join('/');
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.path, JSON.stringify(this.entries, null, 2));
    } catch {
      // best-effort
    }
  }

  enqueue(entry: Omit<DeadLetterEntry, 'id' | 'ts'>): DeadLetterEntry {
    const full: DeadLetterEntry = {
      id: `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      ...entry,
    };
    this.entries.push(full);
    this.persist();
    return full;
  }

  list(limit = 100): DeadLetterEntry[] {
    return this.entries.slice(-limit);
  }

  getById(id: string): DeadLetterEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  remove(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  clear(): void {
    this.entries = [];
    this.persist();
  }

  size(): number {
    return this.entries.length;
  }
}

export const deadLetterQueue = new DeadLetterQueue();
