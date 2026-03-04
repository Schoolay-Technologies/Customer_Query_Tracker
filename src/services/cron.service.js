import cron from "node-cron";
import nodemailer from "nodemailer";
import Schedule from "../models/Schedule.js";

// Create email transporter
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('⚠️ SMTP not configured');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Check and send pending reminders (runs every minute)
async function checkAndSendReminders() {
  console.log('🔍 Checking for pending reminders...');
  
  const transporter = createTransporter();
  if (!transporter) return;

  const now = new Date();

  try {
    // Find schedules with unsent reminders that are due
    const schedules = await Schedule.find({
      'reminders': {
        $elemMatch: {
          sent: false,
          date: { $lte: now }
        }
      }
    });

    for (const schedule of schedules) {
      // Find unsent reminders that are due
      const pendingReminders = schedule.reminders.filter(
        r => !r.sent && new Date(r.date) <= now
      );

      for (const reminder of pendingReminders) {
        await sendReminderEmail(schedule, reminder, transporter);
        
        // Mark as sent
        await Schedule.updateOne(
          { 
            '_id': schedule._id,
            'reminders._id': reminder._id 
          },
          { 
            $set: { 
              'reminders.$.sent': true,
              'reminders.$.sentAt': now
            }
          }
        );
        
        console.log(`✅ Reminder sent for schedule ${schedule._id}`);
      }
    }
  } catch (error) {
    console.error('❌ Error checking reminders:', error);
  }
}

// Send reminder email
async function sendReminderEmail(schedule, reminder, transporter) {
  const eventDate = new Date(schedule.date).toLocaleDateString();
  const eventTime = schedule.time || '09:00';
  const reminderDate = new Date(reminder.date).toLocaleString();
  
  // Calculate days until event
  const daysUntil = Math.ceil((schedule.date - new Date()) / (1000 * 60 * 60 * 24));
  
  let emailSubject = '';
  let emailHtml = '';

  if (schedule.type === 'PRODUCTION') {
    emailSubject = `🏭 Production Reminder: ${schedule.company}`;
    emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Production Schedule Reminder</h2>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>🏭 Company:</strong> ${schedule.company}</p>
          <p><strong>📦 Product:</strong> ${schedule.product || 'Not specified'}</p>
          <p><strong>📅 Event Date:</strong> ${eventDate} at ${eventTime}</p>
          <p><strong>⏰ Days Until Event:</strong> <span style="color: ${daysUntil <= 2 ? '#d32f2f' : '#4CAF50'}; font-weight: bold;">${daysUntil}</span></p>
          <p><strong>🔔 Reminder Time:</strong> ${reminderDate}</p>
          ${schedule.description ? `<p><strong>📝 Description:</strong> ${schedule.description}</p>` : ''}
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">This is an automated reminder from Schoolay Support System.</p>
      </div>
    `;
  } else {
    emailSubject = `🏫 School Camp Reminder: ${schedule.schoolName}`;
    emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">School Camp Schedule Reminder</h2>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>🏫 School:</strong> ${schedule.schoolName}</p>
          <p><strong>🎪 Event:</strong> ${schedule.eventPlanned || 'Not specified'}</p>
          <p><strong>📅 Event Date:</strong> ${eventDate} at ${eventTime}</p>
          <p><strong>⏰ Days Until Event:</strong> <span style="color: ${daysUntil <= 2 ? '#d32f2f' : '#2196F3'}; font-weight: bold;">${daysUntil}</span></p>
          <p><strong>🔔 Reminder Time:</strong> ${reminderDate}</p>
          ${schedule.description ? `<p><strong>📝 Description:</strong> ${schedule.description}</p>` : ''}
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">This is an automated reminder from Schoolay Support System.</p>
      </div>
    `;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'kiran@schoolay.com',
      cc: ['madhavan@schoolay.com', 'customersupport@schoolay.com'],
      subject: emailSubject,
      html: emailHtml,
    });
  } catch (error) {
    console.error('❌ Failed to send reminder email:', error);
    throw error;
  }
}

// Send daily digest (runs at 8 AM)
async function sendDailyDigest() {
  console.log('📊 Sending daily digest...');
  
  const transporter = createTransporter();
  if (!transporter) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  try {
    const upcomingSchedules = await Schedule.find({
      date: { 
        $gte: today,
        $lte: nextWeek
      }
    }).sort({ date: 1 });

    if (upcomingSchedules.length === 0) {
      console.log('No upcoming schedules for digest');
      return;
    }

    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2 style="color: #333;">📅 Daily Schedule Digest</h2>
        <p>Here are your upcoming schedules for the next 7 days (${today.toLocaleDateString()} - ${nextWeek.toLocaleDateString()}):</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #4CAF50; color: white;">
              <th style="padding: 12px; border: 1px solid #ddd;">Date & Time</th>
              <th style="padding: 12px; border: 1px solid #ddd;">Type</th>
              <th style="padding: 12px; border: 1px solid #ddd;">Name</th>
              <th style="padding: 12px; border: 1px solid #ddd;">Details</th>
              <th style="padding: 12px; border: 1px solid #ddd;">Days Left</th>
              <th style="padding: 12px; border: 1px solid #ddd;">Reminders</th>
            </tr>
          </thead>
          <tbody>
    `;

    upcomingSchedules.forEach(schedule => {
      const daysLeft = Math.ceil((schedule.date - today) / (1000 * 60 * 60 * 24));
      const type = schedule.type === 'PRODUCTION' ? '🏭 Production' : '🏫 School Camp';
      const name = schedule.type === 'PRODUCTION' ? schedule.company : schedule.schoolName;
      const detail = schedule.type === 'PRODUCTION' ? schedule.product : schedule.eventPlanned;
      const bgColor = daysLeft <= 2 ? '#ffe6e6' : (daysLeft <= 5 ? '#fff3e0' : '#ffffff');
      
      // Format reminders
      const remindersList = schedule.reminders && schedule.reminders.length > 0
        ? schedule.reminders.map(r => {
            const reminderDate = new Date(r.date).toLocaleString();
            return r.sent ? `✅ ${reminderDate}` : `⏳ ${reminderDate}`;
          }).join('<br>')
        : 'No reminders set';
      
      htmlContent += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px; border: 1px solid #ddd;">${schedule.date.toLocaleDateString()} ${schedule.time || '09:00'}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${type}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${name || '—'}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${detail || '—'}</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${daysLeft <= 2 ? '#d32f2f' : '#4CAF50'};">${daysLeft}</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-size: 12px;">${remindersList}</td>
        </tr>
      `;
    });

    htmlContent += `
          </tbody>
        </table>
        <p style="color: #666; margin-top: 20px;">This is your daily schedule digest from Schoolay Support System.</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'madhavan@schoolay.com',
      cc: ['madhavansivakumar372@gmail.com', 'customersupport@schoolay.com'],
      subject: `📊 Daily Schedule Digest - ${today.toLocaleDateString()}`,
      html: htmlContent,
    });
    
    console.log('✅ Daily digest email sent');
  } catch (error) {
    console.error('❌ Failed to send daily digest:', error);
  }
}

// Initialize cron jobs
export function initCronJobs() {
  console.log('⏰ Initializing cron jobs...');

  // Check for reminders every minute (for precise timing)
  cron.schedule('* * * * *', () => {
    checkAndSendReminders();
  });

  // Send daily digest at 8:00 AM every day
  cron.schedule('0 8 * * *', () => {
    sendDailyDigest();
  });

  // Also run immediately on startup (with delay)
  setTimeout(() => {
    checkAndSendReminders();
    sendDailyDigest();
  }, 10000); // Wait 10 seconds after startup

  console.log('✅ Cron jobs initialized');
}

// Export functions for manual triggering
export {
  checkAndSendReminders,
  sendDailyDigest
};