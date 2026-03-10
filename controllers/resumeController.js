const Resume = require('../models/Resume');

// Deployment time tracking
const deploymentTime = Date.now();
const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

exports.getStatus = (req, res) => {
  const timeElapsed = Date.now() - deploymentTime;
  const isExpired = timeElapsed > TIMEOUT_MS;
  res.json({
    deployedAt: deploymentTime,
    timeElapsed,
    isExpired,
    timeRemaining: Math.max(0, TIMEOUT_MS - timeElapsed)
  });
};

exports.getAllResumes = async (req, res) => {
  try {
    const resumes = await Resume.find().sort({ createdAt: -1 });
    // Transform _id to id for frontend compatibility
    const formattedResumes = resumes.map(r => {
      const obj = r.toObject();
      obj.id = obj._id;
      delete obj._id;
      return obj;
    });
    res.json(formattedResumes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
};

exports.createResume = async (req, res) => {
  if (Date.now() - deploymentTime > TIMEOUT_MS) {
    return res.status(403).json({ error: 'Resume submission time has expired.' });
  }

  try {
    const { personalInfo } = req.body;
    let newResume;

    if (personalInfo && personalInfo.email) {
      newResume = await Resume.findOneAndUpdate(
        { 'personalInfo.email': personalInfo.email }, 
        { ...req.body, updatedAt: new Date() },
        { new: true, upsert: true }
      );
    } else {
      newResume = new Resume({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
      await newResume.save();
    }

    const obj = newResume.toObject();
    obj.id = obj._id;
    res.json(obj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save resume' });
  }
};

exports.updateResume = async (req, res) => {
  try {
    const updated = await Resume.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (updated) {
      const obj = updated.toObject();
      obj.id = obj._id;
      res.json(obj);
    } else {
      res.status(404).json({ error: 'Resume not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update resume' });
  }
};

exports.deleteResume = async (req, res) => {
  try {
    const deleted = await Resume.findByIdAndDelete(req.params.id);
    if (deleted) {
      const obj = deleted.toObject();
      obj.id = obj._id;
      res.json(obj);
    } else {
      res.status(404).json({ error: 'Resume not found' }); 
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete resume' });
  }
};
