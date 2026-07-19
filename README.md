# tracksyra-backend

Standalone Node.js backend for TrackSyra. The source under `server/` and the shared backend utility under `src/lib/` are copied without business-logic changes.

## Commands

```text
npm install
npm run build
npm start
npm run worker
```

Configure production values using `backend-production.env.example` as the environment-variable reference. Do not commit a populated `.env` file.
