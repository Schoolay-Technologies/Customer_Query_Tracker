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
  const items = await Schedule.find().lean();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const past = [];
  const upcoming = [];

  for (const it of items) {
    const d = new Date(it.date);
    d.setHours(0, 0, 0, 0);
    if (d < today) past.push(it);
    else upcoming.push(it);
  }

  past.sort((a, b) => new Date(b.date) - new Date(a.date)); // recent past first
  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date)); // nearest upcoming first

  res.json({ items: [...past, ...upcoming] });
});

router.post("/", upload.single("file"), async (req, res) => {
  const body = req.body;

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
    description: body.description || "",
    attachment,
  });

  res.status(201).json(created);
});

router.patch("/:id", requireSchedulePassword, upload.single("file"), async (req, res) => {
  const update = { ...req.body };
  if (update.date) update.date = new Date(update.date);

  if (req.file) {
    update.attachment = { filename: req.file.originalname, mimetype: req.file.mimetype, data: req.file.buffer };
  }

  const updated = await Schedule.findByIdAndUpdate(req.params.id, update, { new: true });
  res.json(updated);
});

router.delete("/:id", requireSchedulePassword, async (req, res) => {
  await Schedule.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

router.get("/:id/file", async (req, res) => {
  const item = await Schedule.findById(req.params.id).lean();
  if (!item?.attachment?.data) return res.status(404).end();

  res.setHeader("Content-Type", item.attachment.mimetype);
  res.setHeader("Content-Disposition", `attachment; filename="${item.attachment.filename}"`);
  res.send(item.attachment.data);
});

export default router;