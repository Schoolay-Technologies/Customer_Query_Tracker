import { Router } from "express";
import { exportCSV, exportXLSX, exportPDF } from "../controllers/reports.controller.js";

const router = Router();

// examples:
// /api/reports/csv?issueType=Delivery%20Delay
// /api/reports/xlsx?issueType=Wrong%20Size,Missing%20Item&status=OPEN&fromDate=2026-02-01&toDate=2026-02-27
router.get("/csv", exportCSV);
router.get("/xlsx", exportXLSX);
router.get("/pdf", exportPDF);

export default router;