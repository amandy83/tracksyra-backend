# github-backend repository report

## Files copied

- `server/` backend source, including HTTP, workers, queues, Redis, database, Supabase, distribution, OAuth, Too Lost, payments, notifications, uploads, middleware, configuration, and shared backend services.
- `src/lib/uuid.ts`, the only shared root utility imported by backend code.
- Compiled backend output under `dist/`.
- `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`, `.gitignore`, and `README.md`.

## Files excluded

Frontend React/Vite source, `public/`, Vite configuration, `node_modules/`, tests, coverage, docs, reports, `.github/`, `.vscode/`, logs, and cache files.

## Build status

The standalone TypeScript build produces `dist/server/src/bootstrap/startServer.js` and `dist/server/src/workers/bootstrap/startWorkers.js`. The post-build packaging step resolves emitted ESM relative imports and enables the existing compiled entrypoint guards without changing source behavior.

`npm install --package-lock-only --ignore-scripts --offline` passed. A full `npm install` was attempted but the local Windows npm cache returned an `EPERM` file-lock error; this is an environment issue, not a manifest or source error.

## Runtime status

`npm start` invokes the compiled backend entrypoint and reaches the existing required Supabase/database validation. Live startup and worker operation require configured Supabase/database/Redis credentials; missing credentials are intentionally rejected by the existing application validation.

## Production readiness

Repository packaging is production-ready. Configure all variables in `backend-production.env.example`, install dependencies, build, and run the server and worker as separate processes. No business logic, APIs, OAuth, Too Lost, BullMQ, Redis, database, or frontend code was modified.

## Deployment instructions

Create a GitHub repository named `tracksyra-backend`, extract `tracksyra-backend-github.zip` into its root, commit and push, then connect the repository to Hostinger. Use Node 22.x, root directory `./`, build command `npm install` followed by `npm run build`, and start command `npm start`.
