import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import ticketRoutes from "./routes/tickets.routes.js";
import reportRoutes from "./routes/reports.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import schedulesRoutes from "./routes/schedules.routes.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    name: "Customer Query Tracker API",
    status: "running",
  });
});
app.use("/api/tickets", ticketRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/schedules", schedulesRoutes);
const port = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(port, () => console.log(`API running on http://localhost:${port}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });