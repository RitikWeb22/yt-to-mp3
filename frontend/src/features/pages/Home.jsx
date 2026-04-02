import { useState, useEffect } from "react";
import {
  FiMusic,
  FiClipboard,
  FiSettings,
  FiDownload,
  FiZap,
  FiShield,
  FiSmartphone,
} from "react-icons/fi";
import "../styles/Home.scss";
import Downloading from "./Downloading";
import DownloadResult from "./DownloadResult";
import { Link } from "react-router-dom";
import { useDownlod } from "../hook/useDownlod";

const Home = () => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [quality, setQuality] = useState("320");
  const [showResult, setShowResult] = useState(false);

  const {
    videoData,
    isLoading,
    error,
    fetchAndConvert,
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
      await fetchAndConvert(youtubeUrl, quality);
      setShowResult(true);
    } catch (err) {
      console.error("Conversion error:", err);
    }
  };

  const handleKeyDown = async (event) => {
    if (event.key === "Enter") {
      await handleConvert();
    }
  };

  const handleConvertAnother = () => {
    setShowResult(false);
    setYoutubeUrl("");
    resetVideoData();
  };

  // Show DownloadResult page if download is complete
  if (showResult) {
    return (
      <>
        <DownloadResult
          videoData={videoData}
          selectedQuality={quality}
          onConvertAnother={handleConvertAnother}
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
              Make Your Playlist <span className="highlight">Portable</span>
            </h1>
            <p className="subtitle">
              Turn YouTube links into clean MP3 downloads in one tap. Fast
              conversion, richer metadata, and quality control up to 320kbps.
            </p>

            {/* Input Section */}
            <div className="input-section">
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="Paste YouTube link here..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="url-input"
                />
                <button onClick={handleConvert} className="convert-btn">
                  Convert & Preview
                </button>
              </div>
              <div
                className="quality-strip"
                role="radiogroup"
                aria-label="audio quality"
              >
                {[
                  { value: "128", label: "128 kbps", note: "Light" },
                  { value: "192", label: "192 kbps", note: "Balanced" },
                  { value: "256", label: "256 kbps", note: "Crisp" },
                  { value: "320", label: "320 kbps", note: "Studio" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`quality-pill ${quality === item.value ? "active" : ""}`}
                    onClick={() => setQuality(item.value)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                  </button>
                ))}
              </div>
              <p className="disclaimer">
                By using this service, you confirm you have rights to download
                the provided content.
              </p>
            </div>

            <div className="hero-highlights">
              <div>
                <FiZap />
                <span>Quick conversion pipeline</span>
              </div>
              <div>
                <FiShield />
                <span>No account required</span>
              </div>
              <div>
                <FiSmartphone />
                <span>Desktop and mobile friendly</span>
              </div>
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
        isOpen={isLoading}
        onClose={() => {}}
        videoData={videoData}
        onComplete={() => {}}
      />
    </div>
  );
};

export default Home;
