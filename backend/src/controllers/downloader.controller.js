const path = require('path');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ytDlp = require('yt-dlp-exec');
const ytdl = require('@distube/ytdl-core');
const sanitizeFilename = require('sanitize-filename');
const { Transform } = require('stream');
const mongoose = require('mongoose');
const DownloadHistory = require('../models/download.history.model');

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

const COOKIES_FILE_PATH = path.join(process.cwd(), 'cookies.txt');
const ALLOWED_QUALITIES = new Set(['128', '192', '256', '320']);
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'youtube-mp36.p.rapidapi.com';

function extractYouTubeVideoId(rawUrl) {
    try {
        if (YOUTUBE_ID_REGEX.test(rawUrl)) return rawUrl;
        const parsed = new URL(rawUrl);
        if (parsed.hostname.endsWith('youtu.be')) {
            const id = parsed.pathname.replace(/^\//, '').split('/')[0];
            return YOUTUBE_ID_REGEX.test(id) ? id : null;
        }
        if (parsed.searchParams.has('v')) {
            const id = parsed.searchParams.get('v');
            return YOUTUBE_ID_REGEX.test(id) ? id : null;
        }
        return null;
    } catch {
        return null;
    }
}

function normalizeYouTubeUrl(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (YOUTUBE_ID_REGEX.test(trimmed)) {
        return `https://www.youtube.com/watch?v=${trimmed}`;
    }
    try {
        const parsed = new URL(trimmed);
        if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
            return parsed.toString();
        }
        return null;
    } catch {
        return null;
    }
}

function toDurationText(durationSeconds) {
    const sec = Number(durationSeconds);
    if (!Number.isFinite(sec) || sec <= 0) return '--:--';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    if (hrs > 0) {
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIdx = 0;
    while (value >= 1024 && unitIdx < units.length - 1) {
        value /= 1024;
        unitIdx += 1;
    }
    return `${value.toFixed(unitIdx === 0 ? 0 : 2)} ${units[unitIdx]}`;
}

function getYtDlpBaseOptions() {
    const options = {
        noWarnings: true,
        noCallHome: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
    };

    if (process.env.YOUTUBE_COOKIES || fs.existsSync(COOKIES_FILE_PATH)) {
        options.cookies = COOKIES_FILE_PATH;
    }

    return options;
}

function parseFirstHttpLine(output) {
    if (!output || typeof output !== 'string') return '';
    const line = output
        .split('\n')
        .map((item) => item.trim())
        .find((item) => item.startsWith('http://') || item.startsWith('https://'));

    return line || '';
}

async function fetchVideoInfo(url) {
    const metadata = await ytDlp(url, {
        ...getYtDlpBaseOptions(),
        dumpSingleJson: true,
        skipDownload: true,
        noPlaylist: true,
    });

    return {
        title: metadata?.title || 'YouTube Audio',
        thumbnail: metadata?.thumbnail || '',
        duration: Number(metadata?.duration) || null,
        channel: metadata?.uploader || metadata?.channel || 'YouTube',
    };
}

async function fetchVideoInfoWithFallback(url) {
    try {
        return await fetchVideoInfo(url);
    } catch {
        const oembed = await axios.get('https://www.youtube.com/oembed', {
            params: {
                url,
                format: 'json',
            },
            timeout: 12000,
        });

        return {
            title: oembed.data?.title || 'YouTube Audio',
            thumbnail: oembed.data?.thumbnail_url || '',
            duration: null,
            channel: oembed.data?.author_name || 'YouTube',
        };
    }
}

async function getVideoInfoController(req, res) {
    const url = normalizeYouTubeUrl(req.query.url || req.query.id);
    if (!url) {
        return res.status(400).json({ error: 'Valid YouTube URL required as ?url=' });
    }

    try {
        const info = await fetchVideoInfoWithFallback(url);
        return res.json(info);
    } catch (error) {
        return res.status(502).json({
            error: 'Unable to fetch video info from YouTube right now. Please retry or try another link.',
            details: error.message,
        });
    }
}

async function getAudioSourceUrl(url) {
    const attempts = [
        {
            format: 'bestaudio[acodec!=none]/bestaudio/best',
        },
        {
            format: 'bestaudio[ext=m4a]/bestaudio[acodec!=none]/bestaudio/best',
            extractorArgs: 'youtube:player_client=android',
        },
        {
            format: 'bestaudio[ext=webm]/bestaudio[acodec!=none]/bestaudio/best',
            extractorArgs: 'youtube:player_client=ios',
        },
        {
            format: 'bestaudio/best',
            extractorArgs: 'youtube:player_client=mweb',
        },
    ];

    let lastError = null;
    for (const attempt of attempts) {
        try {
            const output = await ytDlp(url, {
                ...getYtDlpBaseOptions(),
                ...attempt,
                getUrl: true,
                noPlaylist: true,
            });

            const streamUrl = parseFirstHttpLine(output);
            if (streamUrl) {
                return streamUrl;
            }
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('No audio stream URL found');
}

async function getSourceAudioStream(url) {
    try {
        const sourceUrl = await getAudioSourceUrl(url);
        const sourceResponse = await axios.get(sourceUrl, {
            responseType: 'stream',
            maxRedirects: 5,
            timeout: 180000,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': '*/*',
            },
        });

        return sourceResponse.data;
    } catch {
        // Fallback for environments where yt-dlp URL extraction is blocked.
        return ytdl(url, {
            quality: 'highestaudio',
            filter: 'audioonly',
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            },
            highWaterMark: 1 << 25,
        });
    }
}

async function getRapidApiMp3Link(url) {
    const videoId = extractYouTubeVideoId(url);
    const rapidApiKey = process.env.RAPIDAPI_KEY;

    if (!videoId || !rapidApiKey) {
        return '';
    }

    const response = await axios.get('https://youtube-mp36.p.rapidapi.com/dl', {
        params: { id: videoId },
        headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': RAPIDAPI_HOST,
        },
        timeout: 25000,
    });

    const link = response?.data?.link;
    return typeof link === 'string' ? link : '';
}

async function streamFileToResponse({ fileUrl, res, safeTitle, historyRecord }) {
    const sourceResponse = await axios.get(fileUrl, {
        responseType: 'stream',
        maxRedirects: 5,
        timeout: 180000,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': '*/*',
        },
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);

    let bytesSent = 0;
    const byteCounter = new Transform({
        transform(chunk, _encoding, callback) {
            bytesSent += chunk.length;
            callback(null, chunk);
        },
    });

    sourceResponse.data
        .on('end', async () => {
            await updateHistorySize(historyRecord?._id, bytesSent);
        })
        .pipe(byteCounter)
        .pipe(res);
}

async function saveHistoryRecord(record) {
    try {
        return await DownloadHistory.create(record);
    } catch {
        return null;
    }
}

async function updateHistorySize(historyId, sizeInBytes) {
    if (!historyId) return;
    try {
        await DownloadHistory.findByIdAndUpdate(historyId, { size: formatBytes(sizeInBytes) });
    } catch {
        // History updates should never break download responses.
    }
}

async function downloadMp3Controller(req, res) {
    const url = normalizeYouTubeUrl(req.query.url || req.query.id);
    const selectedQuality = String(req.query.quality || '320');

    if (!url) {
        return res.status(400).json({ error: 'Valid YouTube URL required as ?url=' });
    }

    const quality = ALLOWED_QUALITIES.has(selectedQuality) ? selectedQuality : '320';

    let info;
    try {
        info = await fetchVideoInfoWithFallback(url);
    } catch {
        info = {
            title: req.query.title || 'YouTube Audio',
            thumbnail: req.query.thumbnail || '',
            duration: null,
            channel: 'YouTube',
        };
    }

    const safeTitle = sanitizeFilename(info.title || 'youtube-audio').slice(0, 120) || 'youtube-audio';
    const durationText = req.query.duration || toDurationText(info.duration);

    const historyRecord = await saveHistoryRecord({
        title: info.title,
        url,
        thumbnail: info.thumbnail,
        duration: durationText,
        quality: `${quality}kbps`,
        size: 'Processing...',
    });

    try {
        const sourceAudioStream = await getSourceAudioStream(url);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);

        let bytesSent = 0;
        const byteCounter = new Transform({
            transform(chunk, _encoding, callback) {
                bytesSent += chunk.length;
                callback(null, chunk);
            },
        });

        ffmpeg(sourceAudioStream)
            .audioCodec('libmp3lame')
            .audioBitrate(`${quality}k`)
            .format('mp3')
            .on('error', (err) => {
                if (!res.headersSent) {
                    res.status(502).json({
                        error: 'Unable to convert audio stream right now. Please retry shortly.',
                        details: err.message,
                    });
                    return;
                }
                res.destroy(err);
            })
            .on('end', async () => {
                await updateHistorySize(historyRecord?._id, bytesSent);
            })
            .pipe(byteCounter)
            .pipe(res);
    } catch (error) {
        try {
            const rapidApiLink = await getRapidApiMp3Link(url);
            if (rapidApiLink) {
                await streamFileToResponse({ fileUrl: rapidApiLink, res, safeTitle, historyRecord });
                return;
            }
        } catch {
            // RapidAPI fallback failed; return the primary failure below.
        }

        return res.status(502).json({
            error: 'Unable to process this YouTube video right now. Please retry or try another link.',
            details: error?.stderr || error.message,
        });
    }
}

async function getDownloadHistoryController(req, res) {
    if (mongoose.connection.readyState !== 1) {
        return res.json([]);
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    try {
        const items = await DownloadHistory.find({})
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        return res.json(items);
    } catch {
        return res.json([]);
    }
}

async function rapidApiYtMp3Controller(req, res) {
    const url = normalizeYouTubeUrl(req.query.id || req.query.url);
    if (!url) {
        return res.status(400).json({ error: 'YouTube video ID or URL required as ?id=' });
    }

    try {
        const info = await fetchVideoInfoWithFallback(url);
        return res.json({
            status: 'ok',
            title: info.title,
            author: info.channel,
            thumbnail: info.thumbnail,
            duration: info.duration,
            message: 'Use /api/download to stream MP3 content.',
        });
    } catch (error) {
        return res.status(502).json({ error: error.message || 'Request failed' });
    }
}

module.exports = {
    getVideoInfoController,
    downloadMp3Controller,
    getDownloadHistoryController,
    rapidApiYtMp3Controller,
};
