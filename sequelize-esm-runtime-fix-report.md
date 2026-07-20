# Sequelize ESM Runtime Fix Report

## Diagnosis

The project uses `"type": "module"`, TypeScript emits native ES modules, and Node.js 22 loads `sequelize@6.37.8` as CommonJS. Runtime named imports such as `import { QueryTypes } from "sequelize"` are not guaranteed by Node's CommonJS named-export detection and caused:

`SyntaxError: Named export 'QueryTypes' not found`

The first failure was at `dist/server/src/distribution/services/sequelizeSqlExecutor.js:1`, corresponding to `server/src/distribution/services/sequelizeSqlExecutor.ts:1`.

## Fix

Only Sequelize import interoperability was changed. Runtime Sequelize values now use the CommonJS-compatible default import form:

```ts
import sequelize from "sequelize";
const { QueryTypes, Sequelize } = sequelize;
```

Files updated:

- `server/src/distribution/services/sequelizeSqlExecutor.ts`
- `server/src/payouts/services/payoutService.ts`
- `server/src/payouts/services/payoutRequestService.ts`
- `server/src/payouts/selectors/getPayoutStatus.ts`
- `server/src/payouts/selectors/getPayoutHistory.ts`
- `server/src/payouts/reconciliation/payoutReconciler.ts`

Type-only Sequelize imports remain type-only. Queries, database configuration, models, APIs, and business logic were not changed.

## Verification

- `npm run build`: PASS
- TypeScript compilation: PASS
- Postbuild patch: PASS
- Initial `npm start` without process-provided secrets: stopped at the existing required-environment validation.
- `npm start` with runtime environment variables and a syntactically valid URL-encoded Redis URL: PASS through Express startup.
- Confirmed log: `operations server listening`, framework `express`, port `8080`.
- The test process remained alive as expected and was stopped by the command timeout; it did not exit from the Sequelize import error.

## Deployment requirement

Hostinger must provide the runtime environment variables through its environment configuration. In particular, `REDIS_URL` must contain a real Redis password encoded for a URL; angle-bracket placeholders are invalid URLs. Secrets are not included in this report.

Commit message: `Fix Sequelize ESM/CommonJS runtime compatibility`

