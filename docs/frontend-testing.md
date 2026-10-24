# Frontend end-to-end test (Playwright)

The Playwright test in `tests/e2e/theme-toggle.spec.ts` opens the public homepage,
turns dark mode on, verifies it stays on after a refresh, then turns light mode
back on. It uses the actual frontend buttons and needs no staff account.

## Run locally

1. Install dependencies: `npm install` (or `npm ci` after the lockfile is updated).
2. Install Playwright: `npm install -D @playwright/test`.
3. Install Chromium: `npx playwright install chromium`.
4. Copy `.env.example` to `.env.local` and set the public Supabase variables
   if needed. The test does not require the service-role key.
5. Run `npm run test:e2e`.

Playwright starts the Next.js dev server automatically at
`http://127.0.0.1:3000` if one is not already running. To test a running
instance instead, set `PLAYWRIGHT_BASE_URL` to its full URL before running the
test. No production or database writes are made by this test.

`npm run test` still runs the existing Vitest API tests; the two suites are
separate. Reports and failure screenshots go to ignored folders.
