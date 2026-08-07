---
name: Drizzle migration ordering
description: SQLite migration discovery depends on the journal timestamp order, not only the listed entry order.
---

Journal timestamps for new Drizzle migrations must be later than all already-applied migrations.

**Why:** A newly registered migration with an older timestamp can be skipped by the migrator while it still reports success, leaving the live database schema behind the application schema.

**How to apply:** When adding a migration entry manually, use a timestamp later than the preceding journal entry and verify the target database with `PRAGMA table_info(...)` after migration.