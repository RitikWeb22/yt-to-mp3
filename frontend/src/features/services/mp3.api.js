import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
const api = axios.create({ baseURL: apiBaseUrl });

/**
 * Fetch YouTube metadata from backend.
 * @param {string} youtubeUrl
 * @returns {Promise<{title: string, thumbnail: string, duration: number|null, channel: string}>}
 */
export const getVideoInfo = async (youtubeUrl) => {
    try {
        const response = await api.get("/info", { params: { url: youtubeUrl } });
        return response.data;
    } catch (error) {
        throw new Error(
            error?.response?.data?.error ||
            "Unable to fetch video info from YouTube right now. Please retry or try another link.",
        );
    }
};

/**
 * Request MP3 stream from backend and return it as Blob.
 * @param {string} youtubeUrl
 * @param {string} quality
 * @param {{title?: string, thumbnail?: string, durationText?: string}} metadata
 * @returns {Promise<Blob>}
 */
export const downloadMp3 = async (youtubeUrl, quality = "320", metadata = {}) => {
    try {
        const response = await api.get("/download", {
            params: {
                url: youtubeUrl,
                quality,
                title: metadata?.title || "",
                thumbnail: metadata?.thumbnail || "",
                duration: metadata?.durationText || "",
            },
            responseType: "blob",
            timeout: 240000,
        });
        return response.data;
    } catch (error) {
        throw new Error(
            error?.response?.data?.error ||
            "Unable to process this YouTube video right now. Please retry or try another link.",
        );
    }
};

/**
 * Fetch recent download history.
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export const getDownloadHistory = async (page = 1, limit = 20) => {
    try {
        const response = await api.get("/history", {
            params: { page, limit },
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch {
        return [];
    }
};

/**
 * Trigger browser download for Blob data.
 * @param {Blob} blob
 * @param {string} filename
 */
export const triggerDownload = (blob, filename = "audio.mp3") => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
};
