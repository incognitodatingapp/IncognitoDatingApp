import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy (must be before body parsers)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clerk middleware
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Serve frontend static files in production with absolute fallback logging
const possiblePaths = [
  path.resolve(process.cwd(), "artifacts/anonmatch/dist"),
  path.resolve(process.cwd(), "dist"),
  path.resolve(__dirname, "../dist"),
  path.resolve(__dirname, "../../dist")
];

console.log("Checking possible client dist paths:");
possiblePaths.forEach(p => {
  console.log(`- ${p} (Exists: ${fs.existsSync(p)})`);
});

const clientDistPath = possiblePaths.find(p => fs.existsSync(p));

if (clientDistPath) {
  console.log(`>>> SUCCESS: Serving static files from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  
  // Safe wildcard route using regex to prevent the PathError crash
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
} else {
  console.log(">>> ERROR: Client dist directory not found in any checked location!");
}

export default app;
