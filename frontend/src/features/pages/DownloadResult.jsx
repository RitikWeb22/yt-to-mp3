import { useState, useEffect } from "react";
import { FiMusic, FiDownload, FiPlus, FiCheckCircle } from "react-icons/fi";
import "../styles/DownloadResult.scss";
import { Link } from "react-router-dom";
import { useDownlod } from "../hook/useDownlod";

const DownloadResult = ({
  videoData,
  onConvertAnother,
  selectedQuality: defaultQuality = "320",
}) => {
  const [selectedQuality, setSelectedQuality] = useState(defaultQuality);
  const { handleDownloadMp3, isLoading, error, clearError } = useDownlod();

  useEffect(() => {
    if (error) {
      alert(error);
      clearError();
    }
  }, [error, clearError]);

  const handleDownload = async () => {
    if (!videoData?.url) {
      alert("Video data is missing");
      return;
    }

    try {
      await handleDownloadMp3(videoData.url, selectedQuality);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  return (
    <div className="download-result">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <span className="logo-icon">
                <FiMusic />
              </span>
              SonicStream
            </div>
            <nav className="nav">
              <Link to="/">Converter</Link>
              <Link to="/history">History</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          <div className="result-card">
            {/* Video Info Section */}
            <div className="result-header">
              {/* Thumbnail */}
              <div className="video-thumbnail-large">
                <img
                  src={videoData?.thumbnail || "/default-thumb.svg"}
                  alt="Video"
                  className="thumbnail"
                />
                <span className="duration">
                  {videoData?.durationText || videoData?.duration || "--:--"}
                </span>
              </div>

              {/* Video Details */}
              <div className="video-details">
                <h1 className="video-title">
                  {videoData?.title || "Untitled Video"}
                </h1>
                <p className="channel-info">
                  {videoData?.channel || "Source: YouTube"}
                </p>
                <div className="status-badge">
                  <span className="status-dot"></span>
                  Conversion Ready
                </div>
              </div>
            </div>

            {/* Quality Selection */}
            <div className="quality-section">
              <label className="quality-label">Select Audio Quality</label>
              <div className="quality-buttons">
                {[
                  { value: "128", label: "128", sublabel: "Standard" },
                  { value: "256", label: "256", sublabel: "High" },
                  { value: "320", label: "320", sublabel: "Insane" },
                ].map((quality) => (
                  <button
                    key={quality.value}
                    className={`quality-btn ${
                      selectedQuality === quality.value ? "active" : ""
                    }`}
                    onClick={() => setSelectedQuality(quality.value)}
                  >
                    <span className="quality-value">{quality.label}</span>
                    <span className="quality-sublabel">{quality.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <button
              className="download-btn"
              onClick={handleDownload}
              disabled={isLoading}
            >
              <span className="download-icon">
                <FiDownload />
              </span>
              {isLoading ? "Downloading..." : "Download MP3"}
            </button>

            <div className="download-tips">
              <FiCheckCircle />
              <span>
                Tip: For spoken content, 128 or 192 kbps is usually enough and
                saves storage.
              </span>
            </div>

            <button className="convert-another-btn" onClick={onConvertAnother}>
              <span className="plus-icon">
                <FiPlus />
              </span>
              Convert Another
            </button>
          </div>

          {/* Disclaimer */}
          <div className="disclaimer-section">
            <p>
              Conversion speed depends on your internet connection and video
              length. Files are automatically deleted from our servers after 1
              hour for your privacy.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>&copy; 2024 YT2MP3 Downloader. All rights reserved.</p>
            <div className="footer-links">
              <a href="#terms">Terms</a>
              <a href="#privacy">Privacy</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DownloadResult;
