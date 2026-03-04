import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import Schedule from "../models/Schedule.js";
import { initAgenda, scheduleReminders } from "../services/agenda.service.js";

dotenv.config();

async function rescheduleAllReminders() {
  try {
    await connectDB(process.env.MONGO_URI);
    await initAgenda();

    const today = new Date();
    const upcomingSchedules = await Schedule.find({
      date: { $gte: today }
    });

    console.log(`Found ${upcomingSchedules.length} upcoming schedules`);

    for (const schedule of upcomingSchedules) {
      await scheduleReminders(schedule);
      console.log(`Rescheduled reminders for schedule: ${schedule._id}`);
    }

    console.log('✅ All reminders rescheduled');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to reschedule reminders:', error);
    process.exit(1);
  }
}

rescheduleAllReminders();