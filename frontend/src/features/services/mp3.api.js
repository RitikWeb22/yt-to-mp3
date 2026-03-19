import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
    baseURL: apiBaseUrl,
    withCredentials: false,
});

const parseApiError = async (error) => {
    if (error?.message === "Network Error") {
        return "Backend server is not reachable.";
    }

    const responseData = error?.response?.data;

    if (responseData instanceof Blob) {
        try {
            const text = await responseData.text();
            const parsed = JSON.parse(text);
            return parsed?.error || "Request failed";
        } catch {
            return "Request failed";
        }
    }

    if (typeof responseData === "string") {
        return responseData;
    }

    return responseData?.error || error?.message || "Request failed";
};

/**
 * Get video information from YouTube URL
 * @param {string} youtubeUrl - YouTube video URL
 * @returns {Promise<{title, thumbnail, duration}>}
 */
export const getVideoInfo = async (youtubeUrl) => {
    try {
        const response = await api.get("/info", {
            params: {
                url: youtubeUrl,
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching video info:", error);
        throw new Error(await parseApiError(error));
    }
};

/**
 * Convert YouTube video to MP3 and download
 * @param {string} youtubeUrl - YouTube video URL
 * @param {string} quality - Audio quality (128, 192, 256, 320)
 * @returns {Promise<Blob>}
 */
export const downloadMp3 = async (youtubeUrl, quality = "320") => {
    try {
        const response = await api.get("/download", {
            params: {
                url: youtubeUrl,
                quality: quality,
            },
            responseType: "blob",
        });
        return response.data;
    } catch (error) {
        console.error("Error downloading MP3:", error);
        throw new Error(await parseApiError(error));
    }
};

/**
 * Trigger the download of blob data
 * @param {Blob} blob - File blob
 * @param {string} filename - File name
 */
export const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename || "audio.mp3");
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
};

/**
 * Get download history
 * @returns {Promise<Array>}
 */
export const getDownloadHistory = async () => {
    try {
        const response = await api.get("/history");
        return response.data;
    } catch (error) {
        console.error("Error fetching download history:", error);
        throw new Error(await parseApiError(error));
    }
};

export default api;