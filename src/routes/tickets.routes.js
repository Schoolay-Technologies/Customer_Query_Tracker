import { Router } from "express";
import { createTicket, listTickets, getTicket, updateTicket } from "../controllers/tickets.controller.js";

const router = Router();

router.post("/", createTicket);
router.get("/", listTickets);
router.get("/:id", getTicket);
router.patch("/:id", updateTicket);

export default router;