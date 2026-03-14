import express from "express";
import cors from "cors";
import { shiftsRouter } from "./routes/shifts.js";
import { scheduleRouter } from "./routes/schedule.js";
import { usersRouter } from "./routes/users.js";
import { orgRouter } from "./routes/organizations.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.use("/api/organizations", orgRouter);
app.use("/api/users", usersRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/shifts", shiftsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
