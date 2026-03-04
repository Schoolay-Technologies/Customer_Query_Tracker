import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  { filename: String, mimetype: String, data: Buffer },
  { _id: false }
);

// Reminder schema for multiple reminders
const ReminderSchema = new mongoose.Schema({
  date: { type: Date, required: true }, // When to send reminder
  sent: { type: Boolean, default: false }, // Whether reminder has been sent
  sentAt: { type: Date }, // When it was actually sent
  type: { type: String, enum: ["email", "notification"], default: "email" }
}, { _id: true });

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

    date: { type: Date, required: true }, // Main event date
    time: { type: String, default: "09:00" }, // Event time (HH:MM format)
    description: { type: String, default: "" },
    attachment: { type: AttachmentSchema, default: null },
    
    // Custom reminders
    reminders: [ReminderSchema],
    
    // Track last notification sent (for backward compatibility)
    lastReminderSent: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", ScheduleSchema);