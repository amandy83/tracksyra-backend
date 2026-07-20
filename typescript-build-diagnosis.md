# TypeScript Build Diagnosis

## Findings

- `package.json` build script: `tsc -p tsconfig.json`
- `typescript` version: `5.9.3`
- Original placement: `devDependencies`
- Runtime/build requirement: the compiler is required during Hostinger's build phase.
- Lockfile: `package-lock.json` contains the same TypeScript version and was updated to match the new root dependency classification.

If Hostinger installs production dependencies only (`npm install --omit=dev`, or an equivalent production-only build setting), packages under `devDependencies` are omitted. In that case the `tsc` executable is unavailable and the build fails with a compiler-not-found error.

## Fix applied

Only `typescript` was moved from `devDependencies` to `dependencies` in:

- `package.json`
- `package-lock.json` root package metadata

No other package, source file, application code, or business logic was changed.

## Verification

- `npm ls typescript --package-lock-only`: `typescript@5.9.3`
- `npm run build`: PASS
- TypeScript compilation: PASS
- Postbuild: PASS

## Hostinger recommendation

Keeping `typescript` in `dependencies` is the safest configuration when Hostinger may omit development dependencies during deployment. The build command remains:

`npm install`

`npm run build`

This ensures `tsc` is installed before the build executes, while the application runtime remains `node server.js`.

