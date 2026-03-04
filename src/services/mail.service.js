import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

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

function formatDate(date) {
  if (!date) return 'Not set';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatTime(time) {
  if (!time) return 'Not set';
  try {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  } catch {
    return time;
  }
}

function getStatusColor(status) {
  return status === 'COMPLETED' ? '#4CAF50' : '#FF9800';
}

function getStatusText(status) {
  return status === 'COMPLETED' ? '✅ Completed' : '⏳ In Progress';
}

export async function sendTaskEmail({ to, employeeName, task }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("⚠️ SMTP not configured. Skipping email.");
    return;
  }

  const subject = `📋 New Task Assigned: ${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Task Assignment</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #1e293b;
          margin: 0;
          padding: 0;
          background-color: #f8fafc;
        }
        
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.15);
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 32px 24px;
          text-align: center;
        }
        
        .header h1 {
          margin: 0;
          color: white;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header p {
          margin: 8px 0 0;
          color: rgba(255,255,255,0.95);
          font-size: 16px;
          font-weight: 400;
        }
        
        .content {
          padding: 32px 24px;
        }
        
        .greeting {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 24px;
        }
        
        .greeting span {
          color: #667eea;
          background: #eef2ff;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 16px;
          font-weight: 500;
        }
        
        .task-card {
          background: #f8fafc;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
        }
        
        .task-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid #e2e8f0;
        }
        
        .description-box {
          background: white;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          border-left: 4px solid #667eea;
          font-style: italic;
          color: #475569;
        }
        
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin: 24px 0;
        }
        
        .meta-item {
          background: white;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        
        .meta-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .meta-value {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }
        
        .status-badge {
          display: inline-block;
          padding: 6px 16px;
          background: ${getStatusColor(task.status)}15;
          color: ${getStatusColor(task.status)};
          border-radius: 30px;
          font-weight: 600;
          font-size: 14px;
          border: 1px solid ${getStatusColor(task.status)}30;
        }
        
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 40px;
          font-weight: 600;
          font-size: 16px;
          margin: 16px 0;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .footer {
          background: #f1f5f9;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        
        .footer-logo {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 12px;
        }
        
        .footer-logo span {
          color: #667eea;
        }
        
        .attachment-info {
          background: #eef2ff;
          padding: 12px;
          border-radius: 8px;
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        @media only screen and (max-width: 600px) {
          .container { margin: 10px; }
          .meta-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 New Task Assignment</h1>
          <p>You have been assigned a new task</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello <span>${employeeName}</span>! 👋
          </div>
          
          <div class="task-card">
            <div class="task-title">Task Details</div>
            
            <div class="description-box">
              "${task.description}"
            </div>
            
            <div class="meta-grid">
              <div class="meta-item">
                <div class="meta-label">📅 Allocated Date</div>
                <div class="meta-value">${formatDate(task.allocatedDate)}</div>
              </div>
              
              <div class="meta-item">
                <div class="meta-label">⏰ Completion Date</div>
                <div class="meta-value">${formatDate(task.completionDate)}</div>
              </div>
              
              <div class="meta-item">
                <div class="meta-label">🕐 Completion Time</div>
                <div class="meta-value">${formatTime(task.completionTime)}</div>
              </div>
              
              <div class="meta-item">
                <div class="meta-label">📊 Status</div>
                <div class="meta-value">
                  <span class="status-badge">${getStatusText(task.status)}</span>
                </div>
              </div>
            </div>
            
            ${task.attachment ? `
              <div class="attachment-info">
                <span style="font-size: 20px;">📎</span>
                <span style="flex: 1; color: #1e293b;">${task.attachment.originalName || 'File attached'}</span>
                <span style="color: #667eea; font-size: 13px;">${(task.attachment.size / 1024).toFixed(1)} KB</span>
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/tasks" class="button">
              View Task Dashboard →
            </a>
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-logo">Schoolay<span>.</span></div>
          <p>Customer Query Tracker</p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">
            © ${new Date().getFullYear()} Schoolay Technologies
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
NEW TASK ASSIGNED - ${employeeName}

Hello ${employeeName},

A new task has been assigned to you:

Task Description: ${task.description}

Details:
- Allocated Date: ${formatDate(task.allocatedDate)}
- Completion Date: ${formatDate(task.completionDate)}
- Completion Time: ${formatTime(task.completionTime)}
- Status: ${task.status}

${task.attachment ? 'A file has been attached to this task.' : ''}

Please log in to the dashboard to view more details.

Thanks,
Schoolay Support Team
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: htmlContent,
      text: textContent,
    });
    
    console.log("✅ Email sent to:", to);
    return info;
  } catch (err) {
    console.error("❌ Email failed:", err);
    throw err;
  }
}