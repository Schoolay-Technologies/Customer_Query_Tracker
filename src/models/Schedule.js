import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  { filename: String, mimetype: String, data: Buffer },
  { _id: false }
);

const ScheduleSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["PRODUCTION", "SCHOOL_CAMP"], required: true },

    company: { type: String, default: "" },
    product: { type: String, default: "" },

    schoolName: { type: String, default: "" },
    eventPlanned: {
      type: String,
      enum: [
        "Ordering Camp",
        "Measurement Camp",
        "Ordering + Measurement Camp",
        "Delivery Camp",
        "General Meeting",
        "Others",
      ],
      default: "Others",
    },

    date: { type: Date, required: true },
    description: { type: String, default: "" },
    attachment: { type: AttachmentSchema, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", ScheduleSchema);