import { useMemo } from "react";
import "../styles/Downloading.scss";

const getDurationText = (duration) => {
  if (!duration) return "--:--";
  if (typeof duration === "number") {
    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const secs = Math.floor(duration % 60);

    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return duration;
};

const Downloading = ({ isOpen, onClose, videoData }) => {
  const progress = useMemo(() => (isOpen ? 65 : 0), [isOpen]);

  const handleCancel = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="download-card">
          {/* Video Thumbnail */}
          <div className="video-thumbnail">
            <img
              src={videoData?.thumbnail || "/default-thumb.svg"}
              alt="Video thumbnail"
              className="thumbnail-img"
            />
            <div className="duration-badge">
              {getDurationText(videoData?.durationText || videoData?.duration)}
            </div>
          </div>

          {/* Video Info */}
          <div className="video-info">
            <h3 className="video-title">
              {videoData?.title || "Fetching video details..."}
            </h3>
            <p className="conversion-status">
              Converting to MP3{" "}
              <span className="quality-badge">
                ({videoData?.quality || "320"}kbps)
              </span>
            </p>
            <p className="processing-status">
              <span className="status-dot"></span> Processing...
            </p>
          </div>

          {/* Progress Section */}
          <div className="progress-section">
            <div className="progress-header">
              <label className="progress-label">CONVERSION PROGRESS</label>
              <span className="progress-percentage">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="warning-text">
              Please do not close this tab. This may take a few moments
              depending on video length.
            </p>
          </div>

          {/* Cancel Button */}
          <button onClick={handleCancel} className="cancel-btn">
            Cancel Conversion
          </button>

          {/* Footer */}
          <div className="modal-footer">
            <p>POWERED BY YT-XPLODE ENGINE</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Downloading;
