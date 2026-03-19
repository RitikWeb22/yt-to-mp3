const ytDlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const sanitizeFilename = require('sanitize-filename');   // npm i sanitize-filename
const rateLimit = require('express-rate-limit');          // npm i express-rate-limit
const DownloadHistory = require('../models/download.history.model');

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

// ─── Rate limiter (attach in your router or app.js) ──────────────────────────
const downloadLimiter = rateLimit({
    windowMs: 60 * 1000,   // 1 minute
    max: 15,               // max 15 requests per IP per minute
    message: { error: 'Too many requests. Please try again later.' },
});

// ─── YouTube URL normalization/validation ─────────────────────────────────────
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'www.youtu.be',
]);

function extractYouTubeVideoId(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();

        if (!YOUTUBE_HOSTS.has(host)) {
            return null;
        }

        if (host.endsWith('youtu.be')) {
            const id = parsed.pathname.replace(/^\//, '').split('/')[0];
            return YOUTUBE_ID_REGEX.test(id) ? id : null;
        }

        const pathname = parsed.pathname;
        if (pathname === '/watch') {
            const id = parsed.searchParams.get('v');
            return YOUTUBE_ID_REGEX.test(id || '') ? id : null;
        }

        if (pathname.startsWith('/shorts/')) {
            const id = pathname.split('/')[2];
            return YOUTUBE_ID_REGEX.test(id || '') ? id : null;
        }

        if (pathname.startsWith('/embed/')) {
            const id = pathname.split('/')[2];
            return YOUTUBE_ID_REGEX.test(id || '') ? id : null;
        }

        return null;
    } catch {
        return null;
    }
}

function normalizeYouTubeURL(rawUrl) {
    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) return null;
    return `https://www.youtube.com/watch?v=${videoId}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
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

// ─── Shared yt-dlp options ────────────────────────────────────────────────────
const METADATA_OPTIONS = {
    dumpSingleJson: true,
    noWarnings: true,
    skipDownload: true,
    noCheckCertificates: true,
    geoBypass: true,
};

const METADATA_FALLBACK_OPTIONS = [
    {
        ...METADATA_OPTIONS,
        extractorArgs: 'youtube:player_client=android,web_embedded',
    },
    {
        ...METADATA_OPTIONS,
        extractorArgs: 'youtube:player_client=ios,web',
    },
];

// ─── In-memory metadata cache (TTL: 10 minutes) ───────────────────────────────
const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function classifyYtDlpError(err) {
    const details = `${err?.message || ''}\n${err?.stderr || ''}`.toLowerCase();

    if (details.includes('not available in your country') || details.includes('this video is not available in your country')) {
        return { status: 451, error: 'This video is region-restricted on the server location.' };
    }

    if (details.includes('confirm you\'re not a bot') || details.includes('sign in to confirm')) {
        return { status: 403, error: 'YouTube blocked this video request from the server. Try another video or retry later.' };
    }

    if (details.includes('video unavailable') || details.includes('private video')) {
        return { status: 404, error: 'This video is unavailable or private.' };
    }

    return { status: 400, error: 'Invalid URL or unable to fetch video info' };
}

async function fetchVideoInfo(videoURL) {
    const cached = infoCache.get(videoURL);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }

    const attempts = [METADATA_OPTIONS, ...METADATA_FALLBACK_OPTIONS];
    let lastError = null;

    for (const options of attempts) {
        try {
            const data = await ytDlp(videoURL, options);
            infoCache.set(videoURL, { data, ts: Date.now() });
            return data;
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error('Could not fetch video metadata');
}

// ─── Controllers ──────────────────────────────────────────────────────────────
async function infoController(req, res) {
    const inputURL = req.query.url;

    if (!inputURL) {
        return res.status(400).json({ error: 'URL is required' });
    }
    const videoURL = normalizeYouTubeURL(inputURL);
    if (!videoURL) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        const info = await fetchVideoInfo(videoURL);
        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
        });
    } catch (err) {
        console.error('Info fetch error:', err.message);
        const mapped = classifyYtDlpError(err);
        res.status(mapped.status).json({ error: mapped.error });
    }
}

async function downloadController(req, res) {
    const inputURL = req.query.url;
    const bitrate = parseBitrate(req.query.quality);

    if (!inputURL) {
        return res.status(400).json({ error: 'URL is required' });
    }
    const videoURL = normalizeYouTubeURL(inputURL);
    if (!videoURL) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        // Fetch metadata (served from cache if /info was already called)
        const info = await fetchVideoInfo(videoURL);
        const { title, thumbnail } = info;

        // Fire DB save in parallel — don't block streaming on it
        const historySave = DownloadHistory.create({
            title,
            url: videoURL,
            thumbnail,
            quality: `${bitrate}kbps`,
            size: 'Processing',
        });

        // Sanitize filename
        const sanitizedTitle = sanitizeFilename(title).substring(0, 100) || 'audio';
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Start streaming immediately without waiting for DB
        const subprocess = ytDlp.exec(
            videoURL,
            {
                format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
                output: '-',
                noWarnings: true,
                noCheckCertificates: true,
                preferFreeFormats: true,
            },
            { stdio: ['ignore', 'pipe', 'pipe'] },
        );

        // Resolve history entry (should be done by now)
        const historyEntry = await historySave;

        // Subprocess timeout — kill after 3 minutes
        const timeout = setTimeout(() => {
            subprocess.kill();
            if (!res.headersSent) {
                res.status(504).json({ error: 'Download timed out' });
            }
        }, 3 * 60 * 1000);

        subprocess.on('error', (err) => {
            clearTimeout(timeout);
            console.error('yt-dlp process error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'yt-dlp failed to process this video' });
            }
        });

        let downloadedBytes = 0;

        const transcodedStream = ffmpeg(subprocess.stdout)
            .audioBitrate(bitrate)
            .format('mp3')
            .outputOptions([
                '-threads', '2',          // use 2 CPU threads
                '-compression_level', '0', // fastest MP3 encoding
                '-vn',                     // strip video stream — faster
            ])
            .on('error', (err) => {
                clearTimeout(timeout);
                console.error('FFmpeg error:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Conversion failed' });
                }
            })
            .pipe();

        transcodedStream.on('data', (chunk) => {
            downloadedBytes += chunk.length;
        });

        transcodedStream.on('end', async () => {
            clearTimeout(timeout);
            try {
                await DownloadHistory.findByIdAndUpdate(historyEntry._id, {
                    size: formatBytes(downloadedBytes),
                });
            } catch (updateErr) {
                console.error('History size update error:', updateErr.message);
            }
        });

        transcodedStream.on('error', async () => {
            clearTimeout(timeout);
            try {
                await DownloadHistory.findByIdAndUpdate(historyEntry._id, { size: 'Failed' });
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    try {
        const history = await DownloadHistory.find()
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);
        res.json(history);
    } catch (err) {
        console.error('History fetch error:', err.message);
        res.status(500).json({ error: 'Could not fetch history' });
    }
}

module.exports = {
    infoController,
    downloadController,
    historyController,
    downloadLimiter,
};
