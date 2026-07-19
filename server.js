import { startServer } from "./dist/server/src/bootstrap/startServer.js";

void startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
