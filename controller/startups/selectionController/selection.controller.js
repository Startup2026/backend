const async_handler = require('express-async-handler');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Application = require('../../../models/application.model');

// Configure transporter (reads from env, with sensible defaults for local dev)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

transporter.verify().catch(err => console.warn('SMTP verify failed:', err));

const sendSelectionNotification = async_handler(async (req, res) => {
  const { subject, message, applicationIdList } = req.body;

  if (!Array.isArray(applicationIdList) || applicationIdList.length === 0) {
    return res.status(400).json({ success: false, error: 'applicationIdList must be a non-empty array' });
  }

  const results = { sent: [], failed: [] };

  for (const applicationId of applicationIdList) {
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      results.failed.push({ applicationId, error: 'Invalid application ID' });
      continue;
    }

    const application = await Application.findById(applicationId)
      .populate('studentId', 'email firstName lastName')
      .populate({ path: 'jobId', populate: { path: 'startupId', select: 'startupName' } });

    if (!application) {
      results.failed.push({ applicationId, error: 'Application not found' });
      continue;
    }

    const student = application.studentId;
    const recipient = student && student.email;

    if (!recipient) {
      results.failed.push({ applicationId, error: 'No student email available' });
      continue;
    }

    const job = application.jobId;
    const jobTitle = job ? job.title : 'N/A';
    const companyName = job && job.startupId ? job.startupId.startupName : 'Company';

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject: subject || `Selection for ${jobTitle}`,
      text: message || `Congratulations! You have been selected for ${jobTitle} at ${companyName}.`,
      html: `
        <p>Dear ${student.firstName || 'Candidate'},</p>
        <p>${message || `Congratulations! You have been selected for the role <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.`}</p>
        <p>Best regards,<br/>${companyName}</p>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
    //   application.status = 'SELECTED';
    //   await application.save();
      results.sent.push({ applicationId, email: recipient });
    } catch (err) {
      results.failed.push({ applicationId, error: err.message });
    }
  }

  return res.status(200).json({ success: true, results });
});

module.exports = {
  sendSelectionNotification
};