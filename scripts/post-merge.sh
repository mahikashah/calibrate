#!/usr/bin/env bash
set -euo pipefail

# Keep merged code and the local database compatible without resetting user data.
npm ci --no-audit --no-fund
npm run db:migrate
rm -rf .next
npm run build