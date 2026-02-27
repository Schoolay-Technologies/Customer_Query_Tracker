import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true, trim: true },
    mobile: { type: String, required: false, index: true, trim: true, default: "" },
    schoolName: { type: String, required: true, index: true, trim: true },
    issueType: { type: String, required: true, index: true, trim: true },
    description: { type: String, default: "", trim: true },

    status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN", index: true },

    // optional: who handled it
    handledBy: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

export default mongoose.model("Ticket", TicketSchema);