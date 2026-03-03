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

// CREATE TASK (sends email)
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const {
      employeeName,
      email,
      description,
      allocatedDate,
      completionDate,
      completionTime,
      status = "NOT_COMPLETED",
    } = req.body;

    if (!employeeName || !email || !description || !allocatedDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const task = await Task.create({
      employeeName: employeeName.trim(),
      email: email.trim(),
      description: description.trim(),
      allocatedDate: new Date(allocatedDate),
      completionDate: completionDate ? new Date(completionDate) : null,
      completionTime: completionTime || "",
      status,
      attachment: req.file
        ? {
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size,
          }
        : null,
    });

    // ✅ Email
    await sendTaskEmail({
      to: task.email,
      subject: `New Task Assigned - ${task.employeeName}`,
      text:
        `Hi ${task.employeeName},\n\n` +
        `A new task has been assigned to you:\n\n` +
        `Task: ${task.description}\n` +
        `Allocated Date: ${task.allocatedDate.toISOString().slice(0, 10)}\n\n` +
        `Thanks,\nSchoolay Support`,
    });

    return res.status(201).json(task);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to create task" });
  }
});

// LIST TASKS
router.get("/", async (req, res) => {
  try {
    const {
      q = "",
      orderId = "",
      mobile = "",
      issueType = "",
      schoolName = "",
      from = "",
      to = "",
      page = "1",
      limit = "50",
    } = req.query;

    const filter = {};

    if (orderId.trim()) filter.orderId = orderId.trim();
    if (mobile.trim()) filter.mobile = mobile.trim();
    if (issueType.trim()) filter.issueType = issueType.trim();
    if (schoolName.trim()) filter.schoolName = schoolName.trim();

    // ✅ Date filter (createdAt)
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    // ✅ free text search
    const qv = q.trim();
    if (qv) {
      filter.$or = [
        { orderId: { $regex: qv, $options: "i" } },
        { mobile: { $regex: qv, $options: "i" } },
        { schoolName: { $regex: qv, $options: "i" } },
        { issueType: { $regex: qv, $options: "i" } },
        { description: { $regex: qv, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Ticket.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    res.json({ items, total, page: pageNum, limit: limitNum, pages });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load tickets" });
  }
});


// ✅ STATUS UPDATE (NO PASSWORD)
router.patch("/:id/status", upload.single("file"), async (req, res) => {
  try {
    const { status, remarks = "" } = req.body;

    if (!status || !["COMPLETED", "NOT_COMPLETED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const update = {
      status,
      remarks: remarks || "",
    };

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

    return res.json(task);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to update status" });
  }
});

// EDIT TASK (PASSWORD)
router.patch("/:id", requireTaskAdminPassword, upload.single("file"), async (req, res) => {
  try {
    const update = {};
    const allowed = ["employeeName", "email", "description", "allocatedDate", "completionDate", "completionTime", "status"];

    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }

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
    if (!task) return res.status(404).json({ message: "Task not found" });

    return res.json(task);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to edit task" });
  }
});

// DELETE TASK (PASSWORD)
router.delete("/:id", requireTaskAdminPassword, async (req, res) => {
  try {
    const out = await Task.findByIdAndDelete(req.params.id);
    if (!out) return res.status(404).json({ message: "Task not found" });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to delete task" });
  }
});

export default router;