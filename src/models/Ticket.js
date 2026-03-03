import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    mobile: { type: String, default: "" }, // ✅ NOT required
    schoolName: { type: String, required: true },
    issueType: { type: String, required: true },
    description: { type: String, default: "" },
    handledBy: { type: String, default: "" },
    status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN" },
  },
  { timestamps: true } // ✅ adds createdAt & updatedAt automatically
);

export default mongoose.model("Ticket", TicketSchema);