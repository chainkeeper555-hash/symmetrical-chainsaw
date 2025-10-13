const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  sessionId: String,
  createdAt: { type: Date, default: Date.now }
});

const linkClickSchema = new mongoose.Schema({
  url: String,
  createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  visitorSchema,
  linkClickSchema,
  contactSchema
};