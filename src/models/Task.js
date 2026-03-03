import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  {
    originalName: String,
    mimeType: String,
    filename: String,
    path: String,
    size: Number,
  },
  { _id: false }
);

const TaskSchema = new mongoose.Schema(
  {
    employeeName: { type: String, required: true },
    email: { type: String, required: true },

    description: { type: String, required: true },

    allocatedDate: { type: Date, required: true },
    completionDate: { type: Date, default: null },
    completionTime: { type: String, default: "" },

    status: { type: String, enum: ["COMPLETED", "NOT_COMPLETED"], default: "NOT_COMPLETED" },

    // ✅ NEW
    remarks: { type: String, default: "" },

    attachment: { type: AttachmentSchema, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Task", TaskSchema);