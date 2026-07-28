import { createServer } from "http";
import { WebSocketServer } from "ws";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "./app";
import { logger } from "./lib/logger";
import { registerConnection, removeConnection } from "./lib/ws";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

// WebSocket server for real-time chat events
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", async (ws, req) => {
  // Authenticate via Clerk session cookie
  // We pass a fake res/next to reuse getAuth
  let connectedUserId: number | null = null;

  try {
    // Parse cookie header for Clerk session
    const auth = getAuth(req as any);
    const clerkId = auth?.userId;
    if (clerkId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
      if (user) {
        connectedUserId = user.id;
        registerConnection(connectedUserId, ws);
        // Mark online
        await db.update(usersTable).set({ isOnline: true }).where(eq(usersTable.id, connectedUserId));
        logger.info({ userId: connectedUserId }, "WS client connected");
      }
    }
  } catch (err) {
    logger.warn({ err }, "WS auth failed");
  }

  if (!connectedUserId) {
    ws.close(1008, "Unauthorized");
    return;
  }

  ws.on("close", async () => {
    removeConnection(connectedUserId);
    try {
      await db.update(usersTable).set({ isOnline: false, isSearching: false }).where(eq(usersTable.id, connectedUserId));
    } catch (err) {
      logger.warn({ err }, "Failed to update offline status");
    }
    logger.info({ userId: connectedUserId }, "WS client disconnected");
  });

  ws.on("error", (err) => {
    logger.warn({ err, userId: connectedUserId }, "WS error");
  });

  // Send initial connection confirmation
  ws.send(JSON.stringify({ type: "connected", userId: connectedUserId }));
});

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
