import express from "express";
import multer from "multer";
import Schedule from "../models/Schedule.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function requireSchedulePassword(req, res, next) {
  const pw = req.header("x-schedule-password");
  if (pw !== process.env.SCHEDULE_ADMIN_PASSWORD) return res.status(401).json({ message: "Invalid password" });
  next();
}

router.get("/", async (req, res) => {
  try {
    const items = await Schedule.find().lean();
    res.json({ items });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ message: "Failed to fetch schedules" });
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const body = req.body;
    
    // Parse reminders if provided
    let reminders = [];
    if (body.reminders) {
      try {
        reminders = JSON.parse(body.reminders).map(r => ({
          ...r,
          date: new Date(r.date)
        }));
      } catch (e) {
        console.error('Failed to parse reminders:', e);
      }
    }

    const attachment = req.file
      ? { filename: req.file.originalname, mimetype: req.file.mimetype, data: req.file.buffer }
      : null;

    const created = await Schedule.create({
      type: body.type,
      company: body.company || "",
      product: body.product || "",
      schoolName: body.schoolName || "",
      eventPlanned: body.eventPlanned || "Others",
      date: new Date(body.date),
      time: body.time || "09:00",
      description: body.description || "",
      attachment,
      reminders
    });

    console.log(`✅ Schedule created: ${created._id} with ${reminders.length} reminders`);
    res.status(201).json(created);
  } catch (error) {
    console.error('Failed to create schedule:', error);
    res.status(500).json({ message: "Failed to create schedule" });
  }
});

router.patch("/:id", requireSchedulePassword, upload.single("file"), async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.date) update.date = new Date(update.date);
    if (update.reminders) {
      try {
        update.reminders = JSON.parse(update.reminders).map(r => ({
          ...r,
          date: new Date(r.date)
        }));
      } catch (e) {
        console.error('Failed to parse reminders:', e);
      }
    }

    if (req.file) {
      update.attachment = { filename: req.file.originalname, mimetype: req.file.mimetype, data: req.file.buffer };
    }

    const updated = await Schedule.findByIdAndUpdate(
      req.params.id, 
      update, 
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    console.log(`✅ Schedule updated: ${updated._id}`);
    res.json(updated);
  } catch (error) {
    console.error('Failed to update schedule:', error);
    res.status(500).json({ message: "Failed to update schedule" });
  }
});

router.delete("/:id", requireSchedulePassword, async (req, res) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    console.log(`✅ Schedule deleted: ${req.params.id}`);
    res.json({ ok: true, message: "Schedule deleted successfully" });
  } catch (error) {
    console.error('Failed to delete schedule:', error);
    res.status(500).json({ message: "Failed to delete schedule" });
  }
});

router.get("/:id/file", async (req, res) => {
  try {
    const item = await Schedule.findById(req.params.id).lean();
    
    if (!item?.attachment?.data) {
      return res.status(404).json({ message: "File not found" });
    }

    res.setHeader("Content-Type", item.attachment.mimetype);
    res.setHeader("Content-Disposition", `attachment; filename="${item.attachment.filename}"`);
    res.send(item.attachment.data);
  } catch (error) {
    console.error('Failed to fetch file:', error);
    res.status(500).json({ message: "Failed to fetch file" });
  }
});

export default router;