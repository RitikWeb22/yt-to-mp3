
const ytDlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const DownloadHistory = require('../models/download.history.model');

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}


function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function parseBitrate(quality) {
    const allowed = new Set([128, 192, 256, 320]);
    const parsed = Number(quality);
    return allowed.has(parsed) ? parsed : 320;
}


async function infoController(req, res) {
    const videoURL = req.query.url;

    if (!videoURL) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const info = await ytDlp(videoURL, {
            dumpSingleJson: true,
            noWarnings: true,
            skipDownload: true,
        });

        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration
        });
    } catch (err) {
        console.error('Info fetch error:', err.message);
        res.status(400).json({ error: 'Invalid URL or unable to fetch video info' });
    }
}

async function downloadController(req, res) {
    const videoURL = req.query.url;
    const bitrate = parseBitrate(req.query.quality);

    if (!videoURL) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Fetch metadata first
        const info = await ytDlp(videoURL, {
            dumpSingleJson: true,
            noWarnings: true,
            skipDownload: true,
        });

        const title = info.title;
        const thumbnail = info.thumbnail;

        // Save to history
        const historyEntry = await DownloadHistory.create({
            title,
            url: videoURL,
            thumbnail,
            quality: `${bitrate}kbps`,
            size: "Processing",
        });

        // Sanitize filename
        const sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Stream audio via yt-dlp and pipe through ffmpeg
        const subprocess = ytDlp.exec(
            videoURL,
            {
                format: 'bestaudio',
                output: '-',
                noWarnings: true,
            },
            {
                stdio: ['ignore', 'pipe', 'pipe'],
            },
        );

        subprocess.on('error', (err) => {
            console.error('yt-dlp process error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'yt-dlp failed to process this video' });
            }
        });

        let downloadedBytes = 0;

        const transcodedStream = ffmpeg(subprocess.stdout)
            .audioBitrate(bitrate)
            .format('mp3')
            .on('error', (err) => {
                console.error('FFmpeg error:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Conversion failed. Ensure ffmpeg is installed and available in PATH.' });
                }
            })
            .pipe();

        transcodedStream.on('data', (chunk) => {
            downloadedBytes += chunk.length;
        });

        transcodedStream.on('end', async () => {
            try {
                await DownloadHistory.findByIdAndUpdate(historyEntry._id, {
                    size: formatBytes(downloadedBytes),
                });
            } catch (updateErr) {
                console.error('History size update error:', updateErr.message);
            }
        });

        transcodedStream.on('error', async () => {
            try {
                await DownloadHistory.findByIdAndUpdate(historyEntry._id, {
                    size: 'Failed',
                });
            } catch (updateErr) {
                console.error('History size update error:', updateErr.message);
            }
        });

        transcodedStream.pipe(res);

    } catch (err) {
        console.error('Download error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed' });
        }
    }
}

async function historyController(req, res) {
    try {
        const history = await DownloadHistory.find().sort({ date: -1 });
        res.json(history);
    } catch (err) {
        console.error('History fetch error:', err.message);
        res.status(500).json({ error: 'Could not fetch history' });
    }
}

module.exports = {
    infoController,
    downloadController,
    historyController
}