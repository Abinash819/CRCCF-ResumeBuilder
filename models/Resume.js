const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  personalInfo: {
    fullName: String,
    email: String,
    phone: String,
    address: String,
    dob: String,
    linkedin: String
  },
  summary: String,
  experience: [{
    company: String,
    position: String,
    startDate: String,
    endDate: String,
    description: String
  }],
  education: [{
    school: String,
    degree: String,
    year: String
  }],
  skills: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resume', resumeSchema);
