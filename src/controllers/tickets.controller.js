import { z } from "zod";
import Ticket from "../models/Ticket.js";

const createSchema = z.object({
  orderId: z.string().min(1),

  // MOBILE IS NOW OPTIONAL
  mobile: z.string().optional().default(""),

  schoolName: z.string().min(1),
  issueType: z.string().min(1),

  description: z.string().optional().default(""),
  handledBy: z.string().optional().default(""),
});

export async function createTicket(req, res) {
  try {
    const data = createSchema.parse(req.body);
    const ticket = await Ticket.create(data);
    return res.status(201).json(ticket);
  } catch (e) {
    return res.status(400).json({ message: "Invalid request", error: String(e) });
  }
}

function isEditPayload(body) {
  const keys = Object.keys(body || {});
  // If updating anything other than status, treat as edit
  return keys.some((k) => k !== "status");
}

export async function listTickets(req, res) {
  try {
    const {
      q = "",
      orderId = "",
      mobile = "",
      issueType = "",
      schoolName = "",
      status = "",
      from = "",
      to = "",
      page = "1",
      limit = "20",
    } = req.query;

    const filter = {};

    // Exact match filters
    if (status && String(status).trim()) filter.status = String(status).trim();
    if (orderId && String(orderId).trim()) filter.orderId = String(orderId).trim();
    if (mobile && String(mobile).trim()) filter.mobile = String(mobile).trim();
    if (issueType && String(issueType).trim()) filter.issueType = String(issueType).trim();

    // ✅ NEW: school filter
    if (schoolName && String(schoolName).trim()) filter.schoolName = String(schoolName).trim();

    // ✅ NEW: date range filter (createdAt)
    if ((from && String(from).trim()) || (to && String(to).trim())) {
      filter.createdAt = {};
      if (from && String(from).trim()) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to && String(to).trim()) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    // "q" search across fields (optional)
    const qv = String(q).trim();
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
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Ticket.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load tickets" });
  }
}

export async function getTicket(req, res) {
  const { id } = req.params;
  const ticket = await Ticket.findById(id);
  if (!ticket) return res.status(404).json({ message: "Not found" });
  res.json(ticket);
}

export async function updateTicket(req, res) {
  try {
    const { id } = req.params;

    // If it's an EDIT, require password
    if (isEditPayload(req.body)) {
      const incoming = req.headers["x-edit-password"] || req.body.editPassword;
      const required = process.env.EDIT_PASSWORD;

      if (!required) {
        return res.status(500).json({ message: "EDIT_PASSWORD not set on server" });
      }
      if (!incoming || String(incoming) !== String(required)) {
        return res.status(401).json({ message: "Invalid edit password" });
      }
    }

    const allowed = [
      "orderId",
      "mobile",
      "schoolName",
      "issueType",
      "description",
      "status",
      "handledBy",
    ];

    const patch = {};
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key];
    }

    const updated = await Ticket.findByIdAndUpdate(id, patch, { new: true });
    if (!updated) return res.status(404).json({ message: "Not found" });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error", error: String(e) });
  }
}