const mongoose = require('mongoose');

const downloadHistorySchema = new mongoose.Schema({
    title: { type: String, required: [true, "Title is required"] },
    url: { type: String, required: [true, "URL is required"] },
    thumbnail: { type: String },
    size: { type: String },
    quality: { type: String, default: "320kbps" },
    date: { type: Date, default: Date.now },
});

const DownloadHistory = mongoose.model('history', downloadHistorySchema);
module.exports = DownloadHistory;