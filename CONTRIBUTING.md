# Contributing

## Source of truth: Kanban

The **Hermes Kanban board** is the primary source of truth for all tasks.
GitHub Issues exist for external visibility but may lag behind.

- Kanban: `hermes kanban list` (requires Hermes Agent access)
- GitHub Issues: https://github.com/Mimo13/auto-balance-bots/issues

## Task flow

```text
1. Kanban task created (by user or subagent)
2. Task claimed → status = running
3. Implementation with strict TDD (test → fail → code → pass)
4. All existing tests must remain green (npm test)
5. Commit + push to main
6. Kanban task completed with summary + metadata
```

## Branch strategy

This project uses trunk-based development:
- `main` is the integration branch
- Commits are squashed per task with descriptive message
- No feature branches for solo development

## Testing

```bash
# Build TypeScript
npm run build

# Run all tests
npm test

# Run a specific test file
node --test dist/api/server.test.js
```

Every new function/method requires a test written first (TDD).

## API

```bash
# Start REST API (paper mode, no orders)
npm run api

# Verify health
curl http://localhost:3141/health
```

## Style

- TypeScript strict mode
- ES modules (`type: "module"` in package.json)
- Async/await, no callbacks
- Named exports preferred over default
- Descriptive error messages
