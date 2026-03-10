const express = require('express');
const router = express.Router();

const resumeController = require('../controllers/resumeController');
const pdfController = require('../controllers/pdfController');

// Status
router.get('/status', resumeController.getStatus);

// Resume CRUD
router.get('/resumes', resumeController.getAllResumes);
router.post('/resumes', resumeController.createResume);
router.put('/resumes/:id', resumeController.updateResume);
router.delete('/resumes/:id', resumeController.deleteResume);

// PDF Generation & Notification
router.post('/generate-pdf', pdfController.generatePdf);
router.post('/send-email', pdfController.sendEmail);
router.post('/send-whatsapp', pdfController.sendWhatsapp);

module.exports = router;
