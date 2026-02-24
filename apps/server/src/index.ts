import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { URLS } from "@mdplane/shared";
import { filesRoute } from "./routes/files";
import { foldersRoute } from "./routes/folders";
import { auditRoute } from "./routes/audit";

import { adminMetricsRoute } from "./routes/admin-metrics";

import { bootstrapRoute } from "./routes/bootstrap";
import { exportRoute } from "./routes/export";
import { statusRoute } from "./routes/status";
import { systemRoute } from "./routes/system";
import { searchRoute } from "./routes/search";
import { apiKeysRoute } from "./routes/api-keys";
import { appendsRoute } from "./routes/appends";
import { authRoute } from "./routes/auth";
import { claimRoute } from "./routes/claim";
import { heartbeatRoute } from "./routes/heartbeat";
import { keysRoute } from "./routes/keys";
import { orchestrationRoute } from "./routes/orchestration";
import { webhooksRoute } from "./routes/webhooks";
import { websocketRoute } from "./routes/websocket";
import { workspaceOrchestrationRoute } from "./routes/workspace-orchestration";
import { workspacesRoute } from "./routes/workspaces";
import { jobsRoute } from "./routes/jobs";
import { auth } from "./core/auth";
import { getIsoTimestamp, getUptimeSeconds } from "./core/process-runtime";
import { rateLimitMiddleware } from "./core/rate-limit-middleware";
import { startBackgroundJobs, stopBackgroundJobs } from "./jobs";
import { serverEnv } from "./config/env";

const isLocalDev = !serverEnv.isProduction;
const ALLOWED_ORIGINS = [
  "https://mdplane.vercel.app",
  URLS.LANDING,
  /^https:\/\/.*\.mdplane\.dev$/,
  // Allow localhost origins in development and test environments
  ...(isLocalDev ? [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] : []),
];

const app = new Elysia()
  .use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Author", "Idempotency-Key"],
    credentials: true,
    maxAge: 86400, // 24 hours
  }))
  .use(rateLimitMiddleware())
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .get("/health", () => ({
    ok: true,
    status: "healthy",
    timestamp: getIsoTimestamp(),
    uptimeSeconds: getUptimeSeconds(),
    version: serverEnv.packageVersion,
  }))
  .get("/", () => ({
    ok: true,
    name: "mdplane-api",
    version: serverEnv.packageVersion,
    docs: URLS.DOCS,
  }))
  .use(bootstrapRoute)
  .use(foldersRoute)
  // IMPORTANT: folders route must be registered before filesRoute because
  // filesRoute includes a wildcard /r/:key/* handler that would otherwise
  // intercept /r/:key/folders and treat it as a file path.
  .use(filesRoute)
  .use(auditRoute)
  .use(exportRoute)
  .use(statusRoute)
  .use(systemRoute)
  .use(searchRoute)
  .use(apiKeysRoute)
  .use(claimRoute)
  .use(appendsRoute)
  .use(authRoute)
  .use(heartbeatRoute)
  .use(keysRoute)
  .use(orchestrationRoute)
  .use(webhooksRoute)
  .use(websocketRoute)
  .use(workspaceOrchestrationRoute)
  .use(workspacesRoute)
  .use(jobsRoute)
  .use(adminMetricsRoute)
  .listen({ port: serverEnv.port, hostname: serverEnv.host });

console.log(
  `🦊 mdplane server is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`   Environment: ${serverEnv.nodeEnv}`);
console.log(`   Health check: http://${app.server?.hostname}:${app.server?.port}/health`);

if (!serverEnv.isTest && !serverEnv.disableBackgroundJobs) {
  startBackgroundJobs();
} else if (serverEnv.disableBackgroundJobs) {
  console.log("Background jobs disabled (DISABLE_BACKGROUND_JOBS=true)");
}

const shutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

  try {
    stopBackgroundJobs();
    console.log("✅ Background jobs stopped");

    await app.stop();
    console.log("✅ Server stopped accepting new connections");

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("✅ Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app };
