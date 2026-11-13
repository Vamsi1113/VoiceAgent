# ADR 002: Using @libsql/client Instead of better-sqlite3 for SQLite Engine

## Context
The PRD specified `better-sqlite3` + `Drizzle ORM` for local SQLite database storage.
During monorepo setup on the developer environment running Node.js `v24.11.1` on Windows x64:
- `better-sqlite3` native prebuilt binaries (`prebuild-install`) do not exist for Node 24 (`v24.11.1`).
- Fallback compilation via `node-gyp rebuild` failed because Visual Studio C++ build tools are not installed.
- Drizzle ORM provides first-class support for `@libsql/client` (`drizzle-orm/libsql`), which is a lightweight, wire-compatible SQLite client with cross-platform and WASM support that requires no local C++ compilation.

## Decision
Use `@libsql/client` with `drizzle-orm/libsql` for SQLite database operations.
The client points directly to the local SQLite database file using `file:./data/companion.db`.

## Consequences
- No C++ compilation or Visual Studio workload required on Windows.
- Compatible with Node.js 20, 22, and 24+.
- Fully transparent drop-in replacement: SQLite schema, tables, queries, and file format are identical.
- Zero changes to external APIs, contracts, or interfaces.
