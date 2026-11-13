import { ToolRegistry } from '@companion/core';
import type { MemoryService, Db } from '@companion/memory';

export function buildToolRegistry(deps: { memoryService: MemoryService; db: Db }): ToolRegistry {
  const registry = new ToolRegistry();

  // T0: get_time
  registry.register({
    tier: 'T0',
    def: {
      name: 'get_time',
      description: 'Get the current date and time.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    execute: async () => {
      return { iso: new Date().toISOString(), local: new Date().toLocaleString('en-IN') };
    },
  });

  // T0: memory_search
  registry.register({
    tier: 'T0',
    def: {
      name: 'memory_search',
      description: 'Search long-term memory for facts about the user.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results', default: 5 },
        },
        required: ['query'],
      },
    },
    execute: async (args) => {
      const query = args['query'] as string;
      const limit = (args['limit'] as number | undefined) ?? 5;
      return deps.memoryService.search(query, limit);
    },
  });

  // T1: memory_add
  registry.register({
    tier: 'T1',
    def: {
      name: 'memory_add',
      description: 'Save a fact or preference to long-term memory.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The fact to remember' },
          category: { type: 'string', description: 'Category (e.g. preference, person, routine)' },
        },
        required: ['text'],
      },
    },
    execute: async (args) => {
      const text = args['text'] as string;
      const category = args['category'] as string | undefined;
      return deps.memoryService.add(text, category);
    },
  });

  // T1: notes_add
  registry.register({
    tier: 'T1',
    def: {
      name: 'notes_add',
      description: 'Create a new note.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Note content' },
        },
        required: ['text'],
      },
    },
    execute: async (args) => {
      const { randomUUID } = await import('node:crypto');
      const { schema } = await import('@companion/memory');
      const id = randomUUID();
      await deps.db.insert(schema.notes).values({
        id,
        text: args['text'] as string,
        createdAt: Date.now(),
      });
      return { id };
    },
  });

  // T1: reminder_create
  registry.register({
    tier: 'T1',
    def: {
      name: 'reminder_create',
      description: 'Create a reminder for the user.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'What to remind about' },
          when: { type: 'string', description: 'ISO 8601 datetime for the reminder (optional)' },
        },
        required: ['text'],
      },
    },
    execute: async (args) => {
      const { randomUUID } = await import('node:crypto');
      const { schema } = await import('@companion/memory');
      const id = randomUUID();
      const dueAt = args['when'] ? new Date(args['when'] as string).getTime() : null;
      await deps.db.insert(schema.reminders).values({
        id,
        text: args['text'] as string,
        dueAt,
        status: 'pending',
        createdAt: Date.now(),
      });
      return { id, dueAt };
    },
  });

  return registry;
}

