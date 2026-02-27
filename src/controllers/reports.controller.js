import Ticket from "../models/Ticket.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import slugify from "slugify";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuery(query) {
  const {
    issueType,
    status,
    fromDate,
    toDate,
    orderId,
    mobile,
    schoolName,
    q,
  } = query;

  const filters = {};
  if (status) filters.status = String(status).trim();

  // issueType can be single OR comma-separated list
  if (issueType) {
    const list = String(issueType)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (list.length === 1) filters.issueType = list[0];
    else if (list.length > 1) filters.issueType = { $in: list };
  }

  if (orderId) filters.orderId = String(orderId).trim();
  if (mobile) filters.mobile = String(mobile).trim();
  if (schoolName) filters.schoolName = String(schoolName).trim();

  // Date range filter (createdAt)
  if (fromDate || toDate) {
    filters.createdAt = {};
    if (fromDate) filters.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      // include entire day by pushing to end of day
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      filters.createdAt.$lte = d;
    }
  }

  const andClauses = [filters];

  if (q && String(q).trim()) {
    const term = String(q).trim();
    const regex = new RegExp(escapeRegex(term), "i");
    andClauses.push({
      $or: [
        { orderId: regex },
        { mobile: regex },
        { schoolName: regex },
        { issueType: regex },
        { description: regex },
      ],
    });
  }

  return andClauses.length > 1 ? { $and: andClauses } : filters;
}

function makeFilename(base, ext) {
  const safe = slugify(base, { lower: true, strict: true }) || "report";
  return `${safe}.${ext}`;
}

async function fetchTickets(req) {
  const mongoQuery = buildQuery(req.query);
  return Ticket.find(mongoQuery).sort({ createdAt: -1 }).lean();
}

// -------- CSV --------
export async function exportCSV(req, res) {
  const items = await fetchTickets(req);

  const fields = [
    { label: "Order ID", value: "orderId" },
    { label: "Mobile", value: "mobile" },
    { label: "School Name", value: "schoolName" },
    { label: "Issue Type", value: "issueType" },
    { label: "Status", value: "status" },
    { label: "Description", value: "description" },
    { label: "Created At", value: (row) => new Date(row.createdAt).toLocaleString() },
    { label: "Updated At", value: (row) => new Date(row.updatedAt).toLocaleString() },
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(items);

  const issueLabel = req.query.issueType ? `issues-${req.query.issueType}` : "issues-all";
  const filename = makeFilename(`${issueLabel}-report`, "csv");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(csv);
}

// -------- EXCEL (XLSX) --------
export async function exportXLSX(req, res) {
  const items = await fetchTickets(req);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tickets");

  ws.columns = [
    { header: "Order ID", key: "orderId", width: 16 },
    { header: "Mobile", key: "mobile", width: 14 },
    { header: "School Name", key: "schoolName", width: 26 },
    { header: "Issue Type", key: "issueType", width: 18 },
    { header: "Status", key: "status", width: 10 },
    { header: "Description", key: "description", width: 40 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ];

  ws.getRow(1).font = { bold: true };

  items.forEach((t) => {
    ws.addRow({
      orderId: t.orderId,
      mobile: t.mobile,
      schoolName: t.schoolName,
      issueType: t.issueType,
      status: t.status,
      description: t.description,
      createdAt: new Date(t.createdAt).toLocaleString(),
      updatedAt: new Date(t.updatedAt).toLocaleString(),
    });
  });

  ws.autoFilter = {
    from: "A1",
    to: "H1",
  };

  const issueLabel = req.query.issueType ? `issues-${req.query.issueType}` : "issues-all";
  const filename = makeFilename(`${issueLabel}-report`, "xlsx");

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await wb.xlsx.write(res);
  res.end();
}

// -------- PDF --------
export async function exportPDF(req, res) {
  const items = await fetchTickets(req);

  const issueLabel = req.query.issueType ? `Issue: ${req.query.issueType}` : "All Issues";
  const filename = makeFilename(`${issueLabel}-report`, "pdf");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 30, size: "A4" });
  doc.pipe(res);

  doc.fontSize(18).text("Support Issue Report", { bold: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#333").text(`${issueLabel}`);
  doc.text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown(1);

  // simple “table-like” layout
  doc.fontSize(10).fillColor("#000");
  const lineGap = 14;

  items.forEach((t, i) => {
    doc
      .fontSize(10)
      .fillColor("#000")
      .text(
        `${i + 1}. ${t.orderId} | ${t.mobile} | ${t.schoolName} | ${t.issueType} | ${t.status}`,
        { lineGap: 2 }
      );
    if (t.description) {
      doc.fillColor("#444").text(`   Notes: ${t.description}`, { lineGap: 2 });
    }
    doc.fillColor("#666").text(
      `   Created: ${new Date(t.createdAt).toLocaleString()}`,
      { lineGap: 2 }
    );
    doc.moveDown(0.6);

    // new page safety
    if (doc.y > 760) doc.addPage();
  });

  doc.end();
}