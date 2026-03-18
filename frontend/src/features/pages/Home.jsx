import { useState, useEffect } from "react";
import { FiMusic, FiClipboard, FiSettings, FiDownload } from "react-icons/fi";
import "../styles/Home.scss";
import Downloading from "./Downloading";
import DownloadResult from "./DownloadResult";
import { Link } from "react-router-dom";
import { useDownlod } from "../hook/useDownlod";

const Home = () => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [quality, setQuality] = useState("320");
  const [isDownloading, setIsDownloading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const {
    videoData,
    isLoading,
    error,
    fetchVideoInfo,
    clearError,
    resetVideoData,
  } = useDownlod();

  useEffect(() => {
    if (error) {
      alert(error);
      clearError();
    }
  }, [error, clearError]);

  const handleConvert = async () => {
    if (!youtubeUrl.trim()) {
      alert("Please paste a YouTube URL");
      return;
    }

    try {
      setIsDownloading(true);
      await fetchVideoInfo(youtubeUrl, quality);
      // Data is set in context, will display in modal
    } catch (err) {
      console.error("Conversion error:", err);
      setIsDownloading(false);
    }
  };

  const handleCloseDownloading = () => {
    setIsDownloading(false);
    resetVideoData();
  };

  const handleDownloadComplete = () => {
    setIsDownloading(false);
    setShowResult(true);
  };

  const handleConvertAnother = () => {
    setShowResult(false);
    setYoutubeUrl("");
    setQuality("320");
    resetVideoData();
  };

  // Show DownloadResult page if download is complete
  if (showResult) {
    return (
      <>
        <DownloadResult
          videoData={videoData}
          onConvertAnother={handleConvertAnother}
        />
        <Downloading
          isOpen={isDownloading}
          onClose={handleCloseDownloading}
          videoData={videoData}
          onComplete={handleDownloadComplete}
        />
      </>
    );
  }

  return (
    <div className="home">
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

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1>
              Convert YouTube to <span className="highlight">High-Quality</span>{" "}
              MP3
            </h1>
            <p className="subtitle">
              Fast, free, and unlimited. Download your favorite soundtracks and
              podcasts in pristine audio quality instantly.
            </p>

            {/* Input Section */}
            <div className="input-section">
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="Paste YouTube link here..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="url-input"
                />
                <button onClick={handleConvert} className="convert-btn">
                  Convert Now
                </button>
              </div>
              <p className="disclaimer">
                By using our service, you accept accepting our Terms of Use.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="process">
        <div className="container">
          <h2>Simple 3-Step Process</h2>
          <p className="process-subtitle">Download any audio in seconds</p>

          <div className="process-cards">
            <div className="card">
              <div className="card-icon">
                <FiClipboard />
              </div>
              <h3>Paste Link</h3>
              <p>
                Copy the URL of your favorite YouTube video and paste it into
                our search box above.
              </p>
            </div>

            <div className="card">
              <div className="card-icon">
                <FiSettings />
              </div>
              <h3>Choose Quality</h3>
              <p>
                Wait for the processing to finish and select your preferred
                bitrate (up to 320 kbps).
              </p>
            </div>

            <div className="card">
              <div className="card-icon">
                <FiDownload />
              </div>
              <h3>Download</h3>
              <p>
                Click the download button and the file will be saved directly to
                your device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quality Selection */}
      <section className="quality-section">
        <div className="container">
          <h2>Select Audio Quality</h2>
          <div className="quality-options">
            {["128", "192", "256", "320"].map((q) => (
              <label key={q} className="quality-option">
                <input
                  type="radio"
                  name="quality"
                  value={q}
                  checked={quality === q}
                  onChange={(e) => setQuality(e.target.value)}
                />
                <span className="quality-label">{q} kbps</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>&copy; 2024 SonicStream. All rights reserved.</p>
            <div className="footer-links">
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Service</a>
              <a href="#dmca">DMCA</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Downloading Modal */}
      <Downloading
        isOpen={isDownloading}
        onClose={handleCloseDownloading}
        videoData={videoData}
        onComplete={handleDownloadComplete}
      />
    </div>
  );
};

export default Home;
