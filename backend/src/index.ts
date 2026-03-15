import "express-async-errors";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { shiftsRouter } from "./routes/shifts.js";
import { scheduleRouter } from "./routes/schedule.js";
import { usersRouter } from "./routes/users.js";
import { orgRouter } from "./routes/organizations.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Configure Security Headers
app.use(helmet());

// Configure CORS (restrict to frontend URL)
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(cors({ origin: frontendUrl }));

app.use(express.json());

app.use("/api/organizations", orgRouter);
app.use("/api/users", usersRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/shifts", shiftsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  if (err && err.name === "ZodError") {
    res.status(400).json({ error: "Validation Error", details: err.errors });
    return;
  }
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
