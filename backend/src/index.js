import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import authRouter from "./routes/auth.js";
import sessionsRouter from "./routes/sessions.js";
import categoriesRouter from "./routes/categories.js";
import causesRouter from "./routes/causes.js";
import actionsRouter from "./routes/actions.js";
import reportRouter from "./routes/report.js";
import { registerSockets } from "./sockets/index.js";

const app = express();
const httpServer = createServer(app);

// Allow FRONTEND_URL (production) and localhost (dev) — both may be needed
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
].filter(Boolean);

const corsOptions = { origin: allowedOrigins, credentials: true };

const io = new Server(httpServer, { cors: corsOptions });

app.set("io", io);

app.use(cors(corsOptions));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions/:sessionId/categories", categoriesRouter);
app.use("/api/sessions/:sessionId/causes", causesRouter);
app.use("/api/sessions/:sessionId/actions", actionsRouter);
app.use("/api", reportRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

registerSockets(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
