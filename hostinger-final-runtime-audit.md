# Hostinger final runtime audit

## Audit scope

The repository was audited using the exact requested sequence:

    npm install
    npm run build
    node server.js

Sequelize transitive deprecation notices (uuid@8.x, dottie) and npm audit output were excluded from the deployment diagnosis.

## Entrypoint verification

- Root server.js: present.
- server.js imports ./dist/server/src/bootstrap/startServer.js and invokes the existing startServer() export.
- dist/server/src/bootstrap/startServer.js: present after build.
- The compiled module imports successfully under Node 22; no CommonJS/ESM mismatch was observed.
- package.json uses type: module and the runtime entrypoint is valid for Node 22.
- server/src/http/operationsServer.ts creates the Express app and calls app.listen() at line 523.

## Build results

- npm run build: PASS.
- tsc -p tsconfig.json: PASS.
- postbuild: PASS.
- Compiled import resolution: PASS.
- npm install: the local sandbox returned an npm-cache EPERM file-lock error while accessing the Windows npm cache. This is an environment/cache permission issue, not a source or lockfile error.

## Runtime result

node server.js exits before Express initialization completes.

Diagnostic output:

    DATABASE_URL: MISSING
    SUPABASE_URL: MISSING
    SUPABASE_SERVICE_ROLE_KEY: MISSING
    Error: Startup environment check failed. Missing required variables: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

First real runtime blocker:

- File: server/src/config/envLoader.ts
- Function: logAndRequireStartupEnvironment()
- Compiled location: dist/server/src/config/envLoader.js:51
- Reason: required production environment variables are absent.

Because this guard runs before createDistributionBootstrapDependencies() and before startOperationsServer(), Express app.listen() at server/src/http/operationsServer.ts:523 is not reached.

## Final deployment status

The compiled backend and Node 22 module structure are deployment-compatible. Hostinger startup requires these environment variables to be configured in the application settings:

    DATABASE_URL
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

After configuring them, rerun npm install, npm run build, and node server.js. No business logic, API, authentication, database schema, OAuth, distribution, or worker logic was modified.
