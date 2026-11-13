import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ── Devices ───────────────────────────────────────────────────────────────────
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  clientType: text('client_type').notNull(),
  createdAt: integer('created_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  revoked: integer('revoked').notNull().default(0),
});

// ── Pairing ───────────────────────────────────────────────────────────────────
export const pairingRequests = sqliteTable('pairing_requests', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  deviceName: text('device_name').notNull(),
  clientType: text('client_type').notNull(),
  approved: integer('approved').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

// ── Auth tokens ───────────────────────────────────────────────────────────────
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
});

// ── Messages ──────────────────────────────────────────────────────────────────
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  turnId: text('turn_id').notNull(),
  role: text('role').notNull(), // user | assistant | tool
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
});

// ── Memories ──────────────────────────────────────────────────────────────────
export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  category: text('category'),
  importance: real('importance').notNull().default(0.5),
  sourceMessageId: text('source_message_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deleted: integer('deleted').notNull().default(0),
});

// ── Reminders ─────────────────────────────────────────────────────────────────
export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  dueAt: integer('due_at'),
  status: text('status').notNull().default('pending'), // pending | done | dismissed
  createdAt: integer('created_at').notNull(),
});

// ── Notes ─────────────────────────────────────────────────────────────────────
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  createdAt: integer('created_at').notNull(),
});

// ── Tool audit log ────────────────────────────────────────────────────────────
export const toolAudit = sqliteTable('tool_audit', {
  id: text('id').primaryKey(),
  ts: integer('ts').notNull(),
  actor: text('actor').notNull(), // device:<id> | mcp:<client>
  tool: text('tool').notNull(),
  tier: text('tier').notNull(),
  argsJson: text('args_json').notNull(),
  decision: text('decision'), // approved | denied | auto | null for T0
  resultSummary: text('result_summary'),
});

// ── Settings ──────────────────────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ── Consents ──────────────────────────────────────────────────────────────────
export const consents = sqliteTable('consents', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // mic | memory | voice_clone
  granted: integer('granted').notNull(),
  ts: integer('ts').notNull(),
});

