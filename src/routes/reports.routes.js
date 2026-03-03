import express from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";
import Ticket from "../models/Ticket.js";

const router = express.Router();

function buildTicketFilter(query) {
  const { issueType, schoolName, from, to } = query;
  const filter = {};
  if (issueType) filter.issueType = issueType;
  if (schoolName) filter.schoolName = schoolName;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  return filter;
}

// CSV
router.get("/tickets.csv", async (req, res) => {
  const filter = buildTicketFilter(req.query);
  const items = await Ticket.find(filter).sort({ createdAt: -1 }).lean();

  const parser = new Parser({
    fields: ["orderId", "mobile", "schoolName", "issueType", "description", "status", "createdAt", "updatedAt"],
  });
  const csv = parser.parse(items);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="tickets.csv"`);
  res.send(csv);
});

// XLSX
router.get("/tickets.xlsx", async (req, res) => {
  const filter = buildTicketFilter(req.query);
  const items = await Ticket.find(filter).sort({ createdAt: -1 }).lean();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tickets");

  ws.columns = [
    { header: "Order ID", key: "orderId", width: 16 },
    { header: "Mobile", key: "mobile", width: 16 },
    { header: "School", key: "schoolName", width: 28 },
    { header: "Issue Type", key: "issueType", width: 22 },
    { header: "Description", key: "description", width: 40 },
    { header: "Status", key: "status", width: 12 },
    { header: "Created", key: "createdAt", width: 22 },
    { header: "Updated", key: "updatedAt", width: 22 },
  ];

  items.forEach((it) => ws.addRow(it));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="tickets.xlsx"`);

  await wb.xlsx.write(res);
  res.end();
});

// PDF (TABLE)
router.get("/tickets.pdf", async (req, res) => {
  const filter = buildTicketFilter(req.query);
  const { issueType, schoolName, from, to } = req.query;

  const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).lean();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="tickets_report.pdf"`);

  const doc = new PDFDocument({ margin: 30, size: "A4" });
  doc.pipe(res);

  doc.fontSize(16).text("Tickets Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#444").text(
    `Filters: Issue=${issueType || "All"} | School=${schoolName || "All"} | From=${from || "-"} | To=${to || "-"}`,
    { align: "center" }
  );
  doc.moveDown(1);

  const startX = 30;
  let y = doc.y;

  const cols = [
    { key: "orderId", label: "Order ID", w: 75 },
    { key: "mobile", label: "Mobile", w: 80 },
    { key: "schoolName", label: "School", w: 140 },
    { key: "issueType", label: "Issue", w: 110 },
    { key: "status", label: "Status", w: 55 },
  ];

  function height(values, widths) {
    const h = values.map((v, i) => doc.heightOfString(String(v || "—"), { width: widths[i] }));
    return Math.max(...h) + 10;
  }

  // Header
  doc.font("Helvetica-Bold").fontSize(9);
  let x = startX;
  cols.forEach((c) => {
    doc.rect(x, y, c.w, 18).stroke();
    doc.text(c.label, x + 4, y + 5, { width: c.w - 8 });
    x += c.w;
  });
  y += 18;
  doc.font("Helvetica").fontSize(9);

  for (const t of tickets) {
    const values = cols.map((c) => String(t[c.key] || "—"));
    const widths = cols.map((c) => c.w - 8);
    const h = height(values, widths);

    if (y + h > doc.page.height - 40) {
      doc.addPage();
      y = 30;
      doc.font("Helvetica-Bold").fontSize(9);
      x = startX;
      cols.forEach((c) => {
        doc.rect(x, y, c.w, 18).stroke();
        doc.text(c.label, x + 4, y + 5, { width: c.w - 8 });
        x += c.w;
      });
      y += 18;
      doc.font("Helvetica").fontSize(9);
    }

    x = startX;
    cols.forEach((c, i) => {
      doc.rect(x, y, c.w, h).stroke();
      doc.text(values[i], x + 4, y + 5, { width: c.w - 8 });
      x += c.w;
    });

    y += h;
  }

  doc.end();
});

export default router;