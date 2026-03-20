import { createContext, useState, useCallback } from "react";
import {
  getVideoInfo,
  downloadMp3,
  triggerDownload,
  getDownloadHistory,
} from "./services/mp3.api";

function formatDuration(seconds) {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "00:00";
  }

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export const DownloadContext = createContext();

export const DownloadProvider = ({ children }) => {
  const [videoData, setVideoData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Fetch video info
  const fetchVideoInfo = useCallback(async (youtubeUrl, quality = "320") => {
    setIsLoading(true);
    setError(null);
    try {
      const info = await getVideoInfo(youtubeUrl);
      const durationSeconds = Number(info?.duration);
      setVideoData({
        ...info,
        url: youtubeUrl,
        quality,
        duration: Number.isFinite(durationSeconds) ? durationSeconds : null,
        durationText: formatDuration(durationSeconds),
      });
      return info;
    } catch (err) {
      const errorMessage = err.message || "Failed to fetch video info";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Download MP3
  const handleDownloadMp3 = useCallback(
    async (youtubeUrl, quality = "320") => {
      setIsLoading(true);
      setError(null);
      setDownloadProgress(0);
      try {
        const blob = await downloadMp3(youtubeUrl, quality, videoData || {});

        // Get filename from videoData or use default
        const filename = videoData?.title
          ? `${videoData.title}.mp3`
          : "audio.mp3";

        triggerDownload(blob, filename);

        // Give backend a brief moment to persist final size before fetching history.
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Refresh history after successful download
        await loadDownloadHistory();

        setDownloadProgress(100);
        return blob;
      } catch (err) {
        const errorMessage = err.message || "Failed to download MP3";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [videoData],
  );

  // Load download history
  const loadDownloadHistory = useCallback(async () => {
    try {
      const data = await getDownloadHistory();
      setHistory(data);
      return data;
    } catch (err) {
      const errorMessage = err.message || "Failed to load history";
      setError(errorMessage);
      setHistory([]);
      return [];
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset video data
  const resetVideoData = useCallback(() => {
    setVideoData(null);
    setDownloadProgress(0);
  }, []);

  const value = {
    videoData,
    isLoading,
    error,
    history,
    downloadProgress,
    fetchVideoInfo,
    handleDownloadMp3,
    loadDownloadHistory,
    clearError,
    resetVideoData,
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
};

export default DownloadContext;
