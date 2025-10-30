const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('News', newsSchema);