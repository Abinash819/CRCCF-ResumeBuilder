const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Helper to sanitize unsupported characters
const sanitizeText = (str) => {
  if (!str) return '';
  return String(str).replace(/[^\x20-\x7F\n\r\t]/g, '');
};

// Internal function to create the locked PDF Buffer directly without QPDF/Puppeteer
async function createPDFBuffer(userName, dob, resumeData) {
  const password = `${userName}-${dob}`;
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const addNewPageIfNeeded = (requiredSpace) => {
    if (y - requiredSpace < margin) {
      page = pdfDoc.addPage();
      y = height - margin;
    }
  };

  const drawTextLine = (text, size, isBold = false) => {
    addNewPageIfNeeded(size);
    page.drawText(sanitizeText(text), {
      x: margin,
      y: y,
      size: size,
      font: isBold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= (size + 8);
  };
  
  const wrapAndDrawText = (text, size, maxWidth, isBold = false) => {
    const words = sanitizeText(text).split(' ');
    let line = '';
    const textFont = isBold ? boldFont : font;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = textFont.widthOfTextAtSize(testLine, size);
      
      if (metrics > maxWidth && i > 0) {
        drawTextLine(line.trim(), size, isBold);
        line = words[i] + ' ';
      } else {
        line = testLine;
      }
    }
    drawTextLine(line.trim(), size, isBold);
  };

  // 1. Header
  const fullName = resumeData.personalInfo?.fullName || userName;
  drawTextLine(fullName, 24, true);
  y -= 5;
  
  const contactInfo = [];
  if (resumeData.personalInfo?.email) contactInfo.push(resumeData.personalInfo.email);
  if (resumeData.personalInfo?.phone) contactInfo.push(resumeData.personalInfo.phone);
  if (resumeData.personalInfo?.address) contactInfo.push(resumeData.personalInfo.address);
  if (contactInfo.length) {
    drawTextLine(contactInfo.join(' | '), 12);
  }
  y -= 15;

  const contentWidth = width - (2 * margin);

  // 2. Summary
  if (resumeData.summary) {
    drawTextLine("Summary", 16, true);
    y -= 5;
    wrapAndDrawText(resumeData.summary, 12, contentWidth);
    y -= 10;
  }

  // 3. Experience
  if (resumeData.experience && resumeData.experience.length > 0) {
    drawTextLine("Experience", 16, true);
    y -= 5;
    resumeData.experience.forEach(exp => {
      const titleLine = `${exp.position || ''} ${exp.company ? `- ${exp.company}` : ''}`;
      drawTextLine(titleLine, 14, true);
      const dates = `${exp.startDate || ''} to ${exp.endDate || 'Present'}`;
      drawTextLine(dates, 10);
      y -= 5;
      if (exp.description) {
        wrapAndDrawText(exp.description, 12, contentWidth);
      }
      y -= 10;
    });
  }

  // 4. Education
  if (resumeData.education && resumeData.education.length > 0) {
    drawTextLine("Education", 16, true);
    y -= 5;
    resumeData.education.forEach(edu => {
      drawTextLine(edu.degree || '', 14, true);
      drawTextLine(`${edu.school || ''} ${edu.year ? `(${edu.year})` : ''}`, 12);
      y -= 10;
    });
  }

  // 5. Skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    const validSkills = resumeData.skills.filter(s => s && s.trim() !== '');
    if (validSkills.length > 0) {
      drawTextLine("Skills", 16, true);
      y -= 5;
      wrapAndDrawText(validSkills.join('  •  '), 12, contentWidth);
    }
  }

  // Encrypt with password
  pdfDoc.encrypt({
    userPassword: password,
    ownerPassword: password,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: true,
    },
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

exports.generatePdf = async (req, res) => {
  try {
    const { userName, dob, resumeData } = req.body;

    if (!userName || !dob) {
      return res.status(400).json({ error: "userName and dob required" });
    }

    const pdfBuffer = await createPDFBuffer(userName, dob, resumeData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="resume_${userName}.pdf"`
    );
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
};

exports.sendEmail = async (req, res) => {
  const { email, userName, dob, resumeData } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required' });
  
  try {
    const pdfBuffer = await createPDFBuffer(userName, dob, resumeData);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'test@example.com',
        pass: process.env.EMAIL_PASS || 'password'
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || 'test@example.com',
      to: email,
      subject: `Your Resume Application: ${userName}`,
      text: `Hello,\n\nPlease find your generated resume attached.\n\nYour PDF is securely locked. The password format is UserName-DOB.\nUse this password to open your resume: ${userName}-${dob}\n\nBest regards,\nProResume Builder`,
      attachments: [
        {
          filename: `resume_${userName}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    if (!process.env.EMAIL_USER) {
      console.log(`[Email Service Mock] Would send to: ${email}`);
      return res.json({ success: true, message: `[Simulated] Resume successfully sent to ${email} (Configure .env with EMAIL_USER and EMAIL_PASS for real delivery)` });
    }

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: `Resume successfully sent to ${email}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email' });
  }
};

exports.sendWhatsapp = async (req, res) => {
  const { phone, userName, dob, resumeData } = req.body;
  if (!phone) return res.status(400).json({ error: 'WhatsApp number is required' });
  
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC_dummy';
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'dummy_token';
    const twilioPhone = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; 

    const twilioClient = twilio(accountSid, authToken);

    const messageBody = `Hello ${userName}!\nYour ProResume has been generated.\n\nSince this is an automated WhatsApp message, please download the PDF directly from the web portal.\n\nYour securely locked PDF Password is: ${userName}-${dob}`;

    if (!process.env.TWILIO_ACCOUNT_SID) {
      console.log(`[WhatsApp Service Mock] Would send to: whatsapp:${phone}`);
      return res.json({ success: true, message: `[Simulated] WhatsApp message successfully sent to ${phone} (Configure .env with TWILIO_ACCOUNT_SID for real delivery)` });
    }

    await twilioClient.messages.create({
      body: messageBody,
      from: twilioPhone,
      to: `whatsapp:${phone.startsWith('+') ? phone : '+' + phone}`
    });
    
    res.json({ success: true, message: `WhatsApp message successfully sent to ${phone}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
};
