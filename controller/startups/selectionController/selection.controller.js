const async_handler = require('express-async-handler');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Application = require('../../../models/application.model');
const Notification = require('../../../models/notification.model');
const { getIo } = require('../../../config/socket');
const { createAndSendNotification } = require('../../../utils/notificationHelper');

// Use nodemailer from existing config or create new transporter
// Usually configured with environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your SMTP provider
  auth: {
    user: process.env.MJ_SENDER_EMAIL, // Assuming this env var holds email
    pass: process.env.EMAIL_PASS || 'your_password' // User needs to set this
  }
});

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
      .populate({ 
        path: 'jobId', 
        populate: { 
          path: 'startupId', 
          select: 'startupName userId',
          populate: { path: 'userId', select: 'email' }
        } 
      });

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
    const startupProfile = job ? job.startupId : null;
    const companyName = startupProfile ? startupProfile.startupName : 'Company';
    const companyEmail = (startupProfile && startupProfile.userId) ? startupProfile.userId.email : null; // Get Startup's real email

    const emailSubject = subject || `Selection for ${jobTitle}`;
    const emailHTML = `
        <p>Dear ${student.firstName || 'Candidate'},</p>
        <p>${message || `Congratulations! You have been selected for the role <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.`}</p>
        <p>Best regards,<br/>${companyName}</p>
    `;

    try {
      const mailOptions = {
        from: `"${companyName}" <${process.env.MJ_SENDER_EMAIL}>`, // Sends from verified platform email
        // to: recipient,
        to:"sanchitskumbhar@gmail.com",
        replyTo: "sanchitskumbhar@gmail.com", // Replies go to startup email
        subject: emailSubject,
        html: emailHTML,
        text: message || `Congratulations! You have been selected for ${jobTitle}.`
      };

      await transporter.sendMail(mailOptions);
      
      // Update DB Status + statusVisible
      application.status = 'SELECTED';
      application.statusVisible = true;
      application.notifiedAt = new Date();
      application.isNotified = true;
      await application.save();

      // Create Notification
      const notification = await Notification.create({
        recipient: student._id,
        title: "Offer Letter",
        message: `Congratulations! You have been selected for the role ${jobTitle} at ${companyName}.`,
        type: 'application_update', 
        relatedId: applicationId
      });

      // Emit Socket Event
      try {
          const io = getIo();
          io.to(student._id.toString()).emit('notification', notification);
          // Standardized event name
          io.to(student._id.toString()).emit("applicationStatusUpdated", { 
            applicationId, 
            status: 'SELECTED',
            jobId: job._id,
            jobRole: jobTitle,
            company: companyName 
          });
          io.to(student._id.toString()).emit('statusUpdate', { applicationId, status: 'SELECTED' });
      } catch(socketErr) {
          console.error("Socket emit failed", socketErr);
      }

      results.sent.push({ applicationId, email: recipient });
    } catch (err) {
      results.failed.push({ applicationId, error: err.message });
    }
  }

  return res.status(200).json({ success: true, results });
});

const sendShortlistNotification = async_handler(async (req, res) => {
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
      .populate({ 
        path: 'jobId', 
        populate: { 
          path: 'startupId', 
          select: 'startupName userId',
          populate: { path: 'userId', select: 'email' }
        } 
      });

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
    const jobTitle = job ? job.role : 'N/A';
    const startupProfile = job ? job.startupId : null;
    const companyName = startupProfile ? startupProfile.startupName : 'Company';
    const companyEmail = (startupProfile && startupProfile.userId) ? startupProfile.userId.email : null; 

    const emailSubject = subject || `Shortlisted for ${jobTitle}`;
    const emailHTML = `
        <p>Dear ${student.firstName || 'Candidate'},</p>
        <p>${message || `We are pleased to inform you that you have been shortlisted for the role <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.`}</p>
        <p>We will contact you shortly with next steps.</p>
        <p>Best regards,<br/>${companyName}</p>
    `;

    try {
        const mailOptions = {
          from: `"${companyName}" <${process.env.MJ_SENDER_EMAIL}>`,
          to: recipient,
          replyTo: companyEmail,
          subject: emailSubject,
          html: emailHTML,
          text: message || `You where shortlisted for ${jobTitle}.`
        };

        await transporter.sendMail(mailOptions);
      
      // Update Status + statusVisible
      application.status = 'SHORTLISTED';
      application.statusVisible = true;
      application.notifiedAt = new Date();
      application.isNotified = true;
      await application.save();

      // Create Notification
      const notification = await Notification.create({
        recipient: student._id,
        title: "Application Shortlisted",
        message: `You have been shortlisted for the role ${jobTitle} at ${companyName}.`,
        type: 'application_update',
        relatedId: applicationId
      });

      // Emit Socket
      try {
        const io = getIo();
        io.to(student._id.toString()).emit('notification', notification);
        io.to(student._id.toString()).emit("applicationStatusUpdated", { 
            applicationId, 
            status: 'SHORTLISTED',
            jobId: job._id,
            jobRole: jobTitle,
            company: companyName 
        });
        io.to(student._id.toString()).emit('statusUpdate', { applicationId, status: 'SHORTLISTED' });
      } catch(socketErr) { console.error(socketErr); }

      results.sent.push({ applicationId, email: recipient });
    } catch (err) {
      results.failed.push({ applicationId, error: err.message });
    }
  }

  return res.status(200).json({ success: true, results });
});

const sendRejectionNotification = async_handler(async (req, res) => {
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
      .populate({ 
        path: 'jobId', 
        populate: { 
          path: 'startupId', 
          select: 'startupName userId',
          populate: { path: 'userId', select: 'email' }
        } 
      });

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
    const jobTitle = job ? job.role : 'N/A';
    const startupProfile = job ? job.startupId : null;
    const companyName = startupProfile ? startupProfile.startupName : 'Company';
    const companyEmail = (startupProfile && startupProfile.userId) ? startupProfile.userId.email : null; 

    const emailSubject = subject || `Update regarding your application for ${jobTitle}`;
    const emailHTML = `
        <p>Dear ${student.firstName || 'Candidate'},</p>
        <p>${message || `Thank you for your interest in the role <strong>${jobTitle}</strong> at <strong>${companyName}</strong>. Unfortunately, we have decided to move forward with other candidates at this time.`}</p>
        <p>We wish you the best in your job search.</p>
        <p>Best regards,<br/>${companyName}</p>
      `;

      try {
        const mailOptions = {
          from: `"${companyName}" <${process.env.MJ_SENDER_EMAIL}>`,
          to: recipient,
          replyTo: companyEmail,
          subject: emailSubject,
          html: emailHTML,
          text: message || `Update for ${jobTitle}.`
        };

        await transporter.sendMail(mailOptions);

       // Update Status + statusVisible
       application.status = 'REJECTED';
      application.statusVisible = true;
      application.notifiedAt = new Date();
      application.isNotified = true;
      await application.save();

      // Create Notification
      const notification = await Notification.create({
        recipient: student._id,
        title: "Application Status Update",
        message: `Update regarding your application for ${jobTitle} at ${companyName}.`,
        type: 'application_update',
        relatedId: applicationId
      });

      // Emit Socket
      try {
        const io = getIo();
        io.to(student._id.toString()).emit('notification', notification);
        io.to(student._id.toString()).emit("applicationStatusUpdated", { 
            applicationId, 
            status: 'REJECTED',
            jobId: job._id,
            jobRole: jobTitle,
            company: companyName 
        });
        io.to(student._id.toString()).emit('statusUpdate', { applicationId, status: 'REJECTED' });
      } catch(socketErr) { console.error(socketErr); }

      results.sent.push({ applicationId, email: recipient });
    } catch (err) {
      results.failed.push({ applicationId, error: err.message });
    }
  }

  return res.status(200).json({ success: true, results });
});

module.exports = {
  sendSelectionNotification,
  sendShortlistNotification,
  sendRejectionNotification
};