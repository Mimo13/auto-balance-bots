# Database Schema — auto-balance-bots

## Overview

Local SQLite database using Node.js built-in `node:sqlite` (v22.22+).
Database file: `data/auto_balance.db` (gitignored).

## Tables

### `_migrations`

Tracks schema version for idempotent upgrades.

| Column | Type | Description |
|--------|------|-------------|
| version | INTEGER (PK) | Schema version number |
| applied_at | TEXT | ISO timestamp when migration ran |

### `advisor_runs`

One row per advisor execution (CLI run or background cycle).

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK, AUTO) | Internal row id |
| run_id | TEXT (UNIQUE) | External run identifier (e.g. UUID) |
| generated_at | TEXT | ISO timestamp of report generation |
| mode | TEXT | Trading mode (paper / testnet / live) |
| network | TEXT | Exchange network (testnet / mainnet) |
| pair_count | INTEGER | Number of pairs in this run |
| capital_total | REAL | Total capital USDC considered |
| capital_reserved | REAL | Reserved capital USDC (e.g. 25%) |
| capital_allocated | REAL | Capital allocated to pairs |
| created_at | TEXT | Auto-filled row creation timestamp |

**Purpose:** Track history of advisor decisions for audit trail and comparison.

### `pair_snapshots`

Per-pair data captured during each advisor run.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK, AUTO) | Internal row id |
| run_id | TEXT (FK → advisor_runs) | Parent run id |
| symbol | TEXT | Trading pair (e.g. BTCUSDC) |
| ok | INTEGER | Boolean: 1 if data fetched successfully |
| price | REAL | Current price at snapshot time |
| score | REAL | Composite score (0–100) |
| target_weight_pct | REAL | Target allocation weight (0–1) |
| range_lower | REAL | Suggested grid lower bound |
| range_upper | REAL | Suggested grid upper bound |
| range_width_pct | REAL | Range width as % of center price |
| reasons | TEXT (JSON array) | Human-readable reasons |
| warnings | TEXT (JSON array) | Human-readable warnings |
| created_at | TEXT | Auto-filled row creation timestamp |

**Purpose:** Raw data per pair per run — enables re-scoring, drift analysis.

### `recommendations`

Actions derived from capital allocation decisions.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK, AUTO) | Internal row id |
| run_id | TEXT (FK → advisor_runs) | Parent run id |
| symbol | TEXT | Trading pair |
| action | TEXT | KEEP / ADD_CAPITAL / REDUCE_CAPITAL / PAUSE_CANDIDATE |
| current_capital_usdc | REAL | Current capital allocated to this pair |
| target_capital_usdc | REAL | Target capital after allocation |
| delta_usdc | REAL | Change required (target - current) |
| reason | TEXT | Human-readable explanation |
| created_at | TEXT | Auto-filled row creation timestamp |

**Purpose:** Record what actions were recommended — enables execution in future phases.

### `bot_allocations` (future)

Persisted bot capital targets (for when execution is active).

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK, AUTO) | Internal row id |
| symbol | TEXT | Trading pair |
| target_weight_pct | REAL | Current target weight |
| target_capital_usdc | REAL | Current target capital |
| is_active | INTEGER | Boolean: bot is active / paused |
| updated_at | TEXT | Last update timestamp |
| created_at | TEXT | Row creation timestamp |

**Purpose:** Persistent bot allocation state between cycles.

### `activity_log_index` (future)

Index table for JSONL activity log files.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK, AUTO) | Internal row id |
| event_type | TEXT | Type of event (e.g. advisor_run_started) |
| symbol | TEXT | Optional trading pair |
| file_path | TEXT | Path to JSONL file |
| line_count | INTEGER | Number of lines in the file |
| created_at | TEXT | Row creation timestamp |

**Purpose:** Enable querying activity logs without scanning JSONL files.

## Usage

```typescript
import { openDatabase, openMemoryDatabase } from './storage/db.js';

// Production — file-based
const db = openDatabase(); // uses data/auto_balance.db

// Testing — in-memory
const memDb = openMemoryDatabase();

// Direct queries
const rows = db.prepare('SELECT * FROM advisor_runs ORDER BY created_at DESC LIMIT 10').all();
```

## Migration Policy

- All schema changes use `CREATE TABLE IF NOT EXISTS` — idempotent by design.
- New columns are added via `ALTER TABLE` in subsequent migration versions.
- The `_migrations` table tracks which version is applied.
- Never drop or modify existing columns — add new tables/columns only.
