import { z } from "zod";
import Ticket from "../models/Ticket.js";

const createSchema = z.object({
  orderId: z.string().min(1),

  // MOBILE IS NOW OPTIONAL
  mobile: z.string().optional().default(""),

  schoolName: z.string().min(1),
  issueType: z.string().min(1),

  description: z.string().optional().default(""),
  handledBy: z.string().optional().default("")
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



/**
 * Search logic:
 * - q (free text) matches orderId/mobile/schoolName/issueType/description
 * - OR use exact filters: orderId, mobile, issueType, schoolName, status
 * - pagination: page, limit
 */
export async function listTickets(req, res) {
  try {
    const {
      q,
      orderId,
      mobile,
      issueType,
      schoolName,
      status,
      page = "1",
      limit = "20"
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (orderId) filters.orderId = String(orderId).trim();
    if (mobile) filters.mobile = String(mobile).trim();
    if (issueType) filters.issueType = String(issueType).trim();
    if (schoolName) filters.schoolName = String(schoolName).trim();

    const andClauses = [filters];

    if (q && String(q).trim()) {
      const term = String(q).trim();
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andClauses.push({
        $or: [
          { orderId: regex },
          { mobile: regex },
          { schoolName: regex },
          { issueType: regex },
          { description: regex }
        ]
      });
    }

    const finalQuery = andClauses.length > 1 ? { $and: andClauses } : filters;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Ticket.find(finalQuery).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Ticket.countDocuments(finalQuery)
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: String(e) });
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

    const allowed = ["orderId", "mobile", "schoolName", "issueType", "description", "status", "handledBy"];
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