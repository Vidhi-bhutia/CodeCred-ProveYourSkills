import mongoose from "mongoose";
import { app } from "./app.js";
import { config, configured } from "./config.js";
import { startSyncWorker } from "./sync.js";
async function start() {
  if (config.production && !configured())
    throw new Error(
      "Production requires MongoDB, OAuth credentials, SESSION_SECRET (32+ chars) and TOKEN_ENCRYPTION_KEY (64 hex chars).",
    );
  if (configured()) {
    await mongoose.connect(config.mongo, { serverSelectionTimeoutMS: 10000 });
  } else
    console.warn(
      "Configuration missing. Serving health and setup errors; authentication is disabled. See README.md.",
    );
  const server = app.listen(config.port, () =>
    console.log(`CodeCred API listening on http://localhost:${config.port}`),
  );
  const stopWorker = configured() ? startSyncWorker() : () => {};
  process.on("SIGTERM", () =>
    server.close(() => {
      stopWorker();
      void mongoose.disconnect();
    }),
  );
}

start().catch(async (error: unknown) => {
  const failure = error as { code?: string; syscall?: string };
  if (
    failure.syscall?.startsWith("query") ||
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEOUT"].includes(failure.code || "")
  ) {
    console.error(
      "MongoDB startup failed: DNS or network connection unavailable. For Atlas SRV resolution errors, set DNS_SERVERS in backend/.env or use the non-SRV connection string supplied by Atlas. See README.md.",
    );
  } else {
    console.error(
      "MongoDB startup failed. Check the database URI, credentials, Atlas IP access list, and network connectivity. No API server was started.",
    );
  }
  await mongoose.disconnect();
  process.exitCode = 1;
});
