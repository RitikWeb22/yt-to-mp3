const ytDlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const { Transform } = require('stream');
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
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
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
    const parsed = Number.parseInt(String(quality || ''), 10);
    return allowed.has(parsed) ? parsed : 320;
}

function formatDurationText(seconds) {
    const totalSeconds = Number(seconds);
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '--:--';

    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    if (hrs > 0) {
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function sanitizeMetadataField(value, maxLen = 200) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLen);
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
        extractorArgs: 'youtube:player_client=android',
    },
    {
        ...METADATA_OPTIONS,
        extractorArgs: 'youtube:player_client=ios',
    },
    {
        ...METADATA_OPTIONS,
        extractorArgs: 'youtube:player_client=web_embedded',
    },
    {
        ...METADATA_OPTIONS,
        extractorArgs: 'youtube:player_client=mweb',
    },
    {
        ...METADATA_OPTIONS,
        extractorArgs: 'youtube:player_client=tv',
    },
    {
        ...METADATA_OPTIONS,
        extractorArgs: 'youtube:player_client=web',
        geoBypass: true,
        socketTimeout: 30,
    },
    {
        ...METADATA_OPTIONS,
        geoBypass: true,
        geoLng: 0,
        geoLat: 0,
    },
    {
        ...METADATA_OPTIONS,
        // Default fallback without args
    },
];

// ─── In-memory metadata cache (TTL: 10 minutes) ───────────────────────────────
const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const COOKIES_FILE_PATH = path.join(__dirname, '../../cookies.txt');

function buildYtDlpRuntimeOptions(options = {}) {
    const merged = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        retries: 0,
        extractorRetries: 0,
        socketTimeout: 8,
        ...options,
    };

    if (fs.existsSync(COOKIES_FILE_PATH)) {
        merged.cookies = COOKIES_FILE_PATH;
    }

    return merged;
}

async function fetchOEmbedInfo(videoURL) {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoURL)}&format=json`;
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`oEmbed failed with status ${response.status}`);
    }

    const payload = await response.json();
    return {
        title: payload.title,
        thumbnail: payload.thumbnail_url,
        duration: null,
    };
}

function isLikelyBotOrBlockError(err) {
    const details = `${err?.message || ''}\n${err?.stderr || ''}`.toLowerCase();
    return (
        details.includes('403')
        || details.includes('confirm you\'re not a bot')
        || details.includes('captcha')
        || details.includes('sign in to confirm')
    );
}

function classifyYtDlpError(err) {
    const message = `${err?.message || ''}`.toLowerCase();
    const stderr = `${err?.stderr || ''}`.toLowerCase();
    const details = `${message}\n${stderr}`;

    if (details.includes('http error 403') || details.includes('403')) {
        return { status: 403, error: 'YouTube server rejected request (403). Server IP may be blocked. Retry in a moment.' };
    }

    if (details.includes('not available in your country') || details.includes('this video is not available in your country')) {
        return { status: 451, error: 'This video is region-restricted on the server location.' };
    }

    if (
        details.includes('confirm you\'re not a bot')
        || details.includes('sign in to confirm you\'re not a bot')
        || (details.includes('sign in') && details.includes('bot'))
        || details.includes('captcha')
    ) {
        return { status: 403, error: 'YouTube detected automated access. Try again in a few moments.' };
    }

    if (
        details.includes('video unavailable')
        || details.includes('private video')
        || details.includes('deleted')
        || details.includes('this video is unavailable')
    ) {
        return { status: 404, error: 'This video is unavailable, private, or has been deleted.' };
    }

    if (
        details.includes('unable to extract')
        || details.includes('unsupported url')
        || details.includes('unable to download webpage')
    ) {
        return { status: 502, error: 'Could not extract video information from YouTube right now. Please retry.' };
    }

    if (details.includes('throttled') || details.includes('rate limit')) {
        return { status: 429, error: 'YouTube rate limited this request. Wait a moment and retry.' };
    }

    return { status: 502, error: 'Unable to fetch video info from YouTube right now. Please retry or try another link.' };
}

async function fetchVideoInfo(videoURL, opts = {}) {
    const { maxAttempts, failFastOnBlock = false } = opts;
    const cached = infoCache.get(videoURL);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }

    const attempts = [METADATA_OPTIONS, ...METADATA_FALLBACK_OPTIONS]
        .slice(0, Math.max(1, Number(maxAttempts) || Number.MAX_SAFE_INTEGER));
    let lastError = null;

    for (let i = 0; i < attempts.length; i++) {
        try {
            const options = buildYtDlpRuntimeOptions(attempts[i]);
            console.log(`[yt-dlp] Attempt ${i + 1}/${attempts.length} for ${videoURL}`);
            const data = await ytDlp(videoURL, options);
            console.log(`[yt-dlp] Success on attempt ${i + 1}: ${data.title}`);
            infoCache.set(videoURL, { data, ts: Date.now() });
            return data;
        } catch (err) {
            lastError = err;
            console.error(`[yt-dlp] Attempt ${i + 1} failed: ${err.message}`);

            if (failFastOnBlock && isLikelyBotOrBlockError(err)) {
                break;
            }
        }
    }

    console.error(`[yt-dlp] All ${attempts.length} attempts failed for ${videoURL}`);
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
        console.log(`[/api/info] Processing: ${videoURL}`);
        // Keep /info responsive with low-latency retries.
        const info = await fetchVideoInfo(videoURL, { maxAttempts: 2, failFastOnBlock: true });
        console.log(`[/api/info] Success: ${info.title} (${info.duration}s)`);
        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
        });
    } catch (err) {
        console.error(`[/api/info] Error for ${videoURL}:`, err.message);
        const mapped = classifyYtDlpError(err);

        if (mapped.status === 403 || mapped.status === 429 || mapped.status === 502) {
            try {
                const fallback = await fetchOEmbedInfo(videoURL);
                console.log(`[/api/info] oEmbed fallback success: ${fallback.title}`);
                return res.json(fallback);
            } catch (oembedErr) {
                console.error(`[/api/info] oEmbed fallback failed: ${oembedErr.message}`);
            }
        }

        res.status(mapped.status).json({ error: mapped.error });
    }
}

async function downloadController(req, res) {
    const inputURL = req.query.url;
    const bitrate = parseBitrate(req.query.quality);
    const clientTitle = sanitizeMetadataField(req.query.title, 200);
    const clientThumbnail = sanitizeMetadataField(req.query.thumbnail, 500);
    const clientDuration = sanitizeMetadataField(req.query.duration, 20);

    if (!inputURL) {
        return res.status(400).json({ error: 'URL is required' });
    }
    const videoURL = normalizeYouTubeURL(inputURL);
    if (!videoURL) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        console.log(`[/api/download] Starting for: ${videoURL} (${bitrate}kbps)`);
        let title = clientTitle || `audio-${extractYouTubeVideoId(videoURL) || Date.now()}`;
        let thumbnail = clientThumbnail || '';
        let duration = clientDuration || '--:--';

        // Reuse client metadata when available to avoid a second metadata round trip.
        if (!clientTitle || !clientThumbnail || !clientDuration) {
            try {
                const info = await fetchVideoInfo(videoURL, { maxAttempts: 1, failFastOnBlock: true });
                console.log(`[/api/download] Metadata fetched: ${info.title}`);
                title = info.title || title;
                thumbnail = info.thumbnail || thumbnail;
                duration = formatDurationText(info.duration);
            } catch (metaErr) {
                console.warn(`[/api/download] Metadata unavailable, proceeding with fallback title: ${metaErr.message}`);
            }
        }

        // Fire DB save in parallel — don't block streaming on it
        const historySave = DownloadHistory.create({
            title,
            url: videoURL,
            thumbnail,
            duration,
            quality: `${bitrate}kbps`,
            size: 'Processing',
        });

        // Start streaming immediately without waiting for DB
        const subprocess = ytDlp.exec(
            videoURL,
            buildYtDlpRuntimeOptions({
                format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
                output: '-',
                noWarnings: true,
                noCheckCertificates: true,
                preferFreeFormats: true,
            }),
            { stdio: ['ignore', 'pipe', 'pipe'] },
        );

        // Resolve history entry (should be done by now)
        const historyEntry = await historySave;
        let historyMarkedFailed = false;

        const markHistoryFailed = async () => {
            if (historyMarkedFailed) return;
            historyMarkedFailed = true;
            try {
                await DownloadHistory.findByIdAndUpdate(historyEntry._id, { size: 'Failed' });
            } catch (updateErr) {
                console.error('History size update error:', updateErr.message);
            }
        };

        // Subprocess timeout — kill after 3 minutes
        const timeout = setTimeout(() => {
            subprocess.kill();
            if (!res.headersSent) {
                res.status(504).json({ error: 'Download timed out' });
            }
            markHistoryFailed();
        }, 3 * 60 * 1000);

        let ytDlpStderr = '';
        if (subprocess.stderr) {
            subprocess.stderr.on('data', (chunk) => {
                ytDlpStderr += String(chunk || '');
            });
        }

        subprocess.on('error', (err) => {
            clearTimeout(timeout);
            console.error('yt-dlp process error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'yt-dlp failed to process this video' });
            }
            markHistoryFailed();
        });

        subprocess.on('close', (code) => {
            if (code === 0) return;

            clearTimeout(timeout);
            console.error(`yt-dlp exited with code ${code}`);
            if (!res.headersSent) {
                const mapped = classifyYtDlpError({ message: `yt-dlp exit code ${code}`, stderr: ytDlpStderr });
                res.status(mapped.status).json({ error: mapped.error });
            }
            markHistoryFailed();
        });

        let downloadedBytes = 0;
        let headersSentForFile = false;

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

        const counterStream = new Transform({
            transform(chunk, encoding, callback) {
                if (!headersSentForFile) {
                    const sanitizedTitle = sanitizeFilename(title).substring(0, 100) || 'audio';
                    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.mp3"`);
                    res.setHeader('Content-Type', 'audio/mpeg');
                    headersSentForFile = true;
                }
                downloadedBytes += chunk.length;
                callback(null, chunk);
            },
        });

        transcodedStream.on('end', async () => {
            clearTimeout(timeout);
            try {
                if (downloadedBytes > 0) {
                    await DownloadHistory.findByIdAndUpdate(historyEntry._id, {
                        size: formatBytes(downloadedBytes),
                    });
                } else {
                    await markHistoryFailed();
                    if (!res.headersSent) {
                        return res.status(502).json({ error: 'No audio data received from source video.' });
                    }
                }
            } catch (updateErr) {
                console.error('History size update error:', updateErr.message);
            }
        });

        transcodedStream.on('error', async () => {
            clearTimeout(timeout);
            await markHistoryFailed();
        });

        transcodedStream.pipe(counterStream).pipe(res);

    } catch (err) {
        console.error(`[/api/download] Error for ${videoURL}:`, err.message);
        const mapped = classifyYtDlpError(err);
        if (!res.headersSent) {
            res.status(mapped.status).json({ error: mapped.error });
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
