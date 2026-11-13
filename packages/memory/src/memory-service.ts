import { eq, desc, like, and, sql } from 'drizzle-orm';
import type { Db } from './db.js';
import { memories } from './schema.js';
import { randomUUID } from 'node:crypto';

export interface MemoryRecord {
  id: string;
  text: string;
  category: string | null;
  importance: number;
  createdAt: number;
  updatedAt: number;
}

export class MemoryService {
  constructor(private db: Db) {}

  async add(text: string, category?: string, sourceMessageId?: string): Promise<MemoryRecord> {
    const now = Date.now();
    const id = randomUUID();
    await this.db.insert(memories).values({
      id,
      text,
      category: category ?? null,
      importance: 0.5,
      sourceMessageId: sourceMessageId ?? null,
      createdAt: now,
      updatedAt: now,
      deleted: 0,
    });
    return { id, text, category: category ?? null, importance: 0.5, createdAt: now, updatedAt: now };
  }

  async search(query: string, limit = 10): Promise<MemoryRecord[]> {
    // Simple FTS-style search using LIKE for MVP (Phase 7 adds sqlite-vec)
    const rows = await this.db
      .select()
      .from(memories)
      .where(and(eq(memories.deleted, 0), like(memories.text, `%${query}%`)))
      .orderBy(desc(memories.importance), desc(memories.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      category: r.category,
      importance: r.importance,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async list(limit = 50): Promise<MemoryRecord[]> {
    const rows = await this.db
      .select()
      .from(memories)
      .where(eq(memories.deleted, 0))
      .orderBy(desc(memories.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      category: r.category,
      importance: r.importance,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async update(id: string, text: string): Promise<void> {
    await this.db
      .update(memories)
      .set({ text, updatedAt: Date.now() })
      .where(and(eq(memories.id, id), eq(memories.deleted, 0)));
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(memories)
      .set({ deleted: 1, updatedAt: Date.now() })
      .where(eq(memories.id, id));
  }

  async getRecent(limit: number): Promise<MemoryRecord[]> {
    return this.list(limit);
  }
}

