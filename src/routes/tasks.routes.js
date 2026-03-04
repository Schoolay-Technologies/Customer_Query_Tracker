import express from "express";
import multer from "multer";
import Task from "../models/Task.js";
import { sendTaskEmail } from "../services/mail.service.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

function requireTaskAdminPassword(req, res, next) {
  const pw = req.headers["x-task-password"];
  if (!pw || pw !== process.env.TASK_ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Invalid password" });
  }
  next();
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { employeeName, email, description, allocatedDate, completionDate, completionTime, status = "NOT_COMPLETED" } = req.body;

    if (!employeeName || !email || !description || !allocatedDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const attachment = req.file ? {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
    } : null;

    const task = await Task.create({
      employeeName: employeeName.trim(),
      email: email.trim(),
      description: description.trim(),
      allocatedDate: new Date(allocatedDate),
      completionDate: completionDate ? new Date(completionDate) : null,
      completionTime: completionTime || "",
      status,
      attachment,
    });

    try {
      await sendTaskEmail({
        to: task.email,
        employeeName: task.employeeName,
        task: {
          description: task.description,
          allocatedDate: task.allocatedDate,
          completionDate: task.completionDate,
          completionTime: task.completionTime,
          status: task.status,
          attachment: task.attachment
        }
      });
    } catch (emailError) {
      console.error('❌ Email failed:', emailError);
    }

    res.status(201).json(task);
  } catch (e) {
    console.error("❌ Failed to create task:", e);
    res.status(500).json({ message: "Failed to create task" });
  }
});

router.get("/", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json({ items: tasks });
  } catch (e) {
    res.status(500).json({ message: "Failed to load tasks" });
  }
});

router.patch("/:id/status", upload.single("file"), async (req, res) => {
  try {
    const { status, remarks = "" } = req.body;
    if (!status || !["COMPLETED", "NOT_COMPLETED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const update = { status, remarks };
    if (req.file) {
      update.attachment = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
      };
    }

    const task = await Task.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (e) {
    res.status(500).json({ message: "Failed to update status" });
  }
});

router.patch("/:id", requireTaskAdminPassword, upload.single("file"), async (req, res) => {
  try {
    const update = {};
    const allowed = ["employeeName", "email", "description", "allocatedDate", "completionDate", "completionTime", "status"];
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
    if (update.allocatedDate) update.allocatedDate = new Date(update.allocatedDate);
    if (update.completionDate) update.completionDate = new Date(update.completionDate);
    if (req.file) {
      update.attachment = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
      };
    }
    const task = await Task.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(task);
  } catch (e) {
    res.status(500).json({ message: "Failed to edit task" });
  }
});

router.delete("/:id", requireTaskAdminPassword, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete task" });
  }
});

export default router;