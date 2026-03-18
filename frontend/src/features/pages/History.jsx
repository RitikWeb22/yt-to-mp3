import { useEffect, useState } from "react";
import {
  FiMusic,
  FiSearch,
  FiDownload,
  FiArrowLeft,
  FiArrowRight,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import "../styles/History.scss";
import { useDownlod } from "../hook/useDownlod";

const History = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  const {
    history,
    isLoading,
    error,
    loadDownloadHistory,
    handleDownloadMp3,
    clearError,
  } = useDownlod();

  useEffect(() => {
    loadDownloadHistory().catch(() => {});
  }, [loadDownloadHistory]);

  useEffect(() => {
    if (error) {
      alert(error);
      clearError();
    }
  }, [error, clearError]);

  const filteredDownloads = (history || []).filter((download) =>
    String(download?.title || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDownloads.length / itemsPerPage),
  );
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDownloads = filteredDownloads.slice(startIndex, endIndex);

  const handleRedownload = async (url, quality = "320") => {
    if (!url) {
      alert("Download URL not available for this item.");
      return;
    }

    try {
      await handleDownloadMp3(url, quality);
      await loadDownloadHistory();
    } catch (err) {
      console.error("Redownload error:", err);
    }
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="history">
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
              <Link to="/history" className="active">
                History
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          <div className="page-header">
            <div>
              <h1>My Downloads</h1>
              <p className="subtitle">
                Manage and access your previous conversions.
              </p>
            </div>

            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Search by title..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="search-input"
              />
              <span className="search-icon">
                <FiSearch />
              </span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="downloads-table">
              <thead>
                <tr>
                  <th className="video-col">VIDEO</th>
                  <th className="size-col">SIZE</th>
                  <th className="date-col">DATE</th>
                  <th className="action-col">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {currentDownloads.length > 0 ? (
                  currentDownloads.map((download) => (
                    <tr
                      key={download._id || download.id || download.url}
                      className="download-row"
                    >
                      <td className="video-cell">
                        <div className="video-info">
                          <div className="thumbnail-wrapper">
                            <img
                              src={download.thumbnail || "/default-thumb.svg"}
                              alt={download.title || "Downloaded video"}
                              className="thumbnail"
                            />
                            <span className="duration">
                              {download.duration || "--:--"}
                            </span>
                          </div>
                          <div className="video-details">
                            <p className="title">
                              {download.title || "Untitled video"}
                            </p>
                            <p className="channel">
                              {download.channel || "YouTube • MP3"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="size-cell">{download.size || "-"}</td>
                      <td className="date-cell">
                        {download.date
                          ? new Date(download.date).toLocaleDateString()
                          : download.createdAt
                            ? new Date(download.createdAt).toLocaleDateString()
                            : "-"}
                      </td>
                      <td className="action-cell">
                        <button
                          className="redownload-btn"
                          onClick={() =>
                            handleRedownload(
                              download.url,
                              download.quality || "320",
                            )
                          }
                          disabled={isLoading || !download.url}
                        >
                          <span className="download-icon">
                            <FiDownload />
                          </span>
                          {isLoading ? "Downloading..." : "Redownload"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="no-data">
                      {isLoading ? "Loading history..." : "No downloads found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredDownloads.length > 0 && (
            <div className="pagination-wrapper">
              <p className="pagination-info">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, filteredDownloads.length)} of{" "}
                {filteredDownloads.length} entries
              </p>
              <nav className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(safePage - 1)}
                  disabled={safePage === 1}
                >
                  <FiArrowLeft />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={`pagination-btn ${
                        safePage === page ? "active" : ""
                      }`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ),
                )}

                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(safePage + 1)}
                  disabled={safePage === totalPages}
                >
                  <FiArrowRight />
                </button>
              </nav>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>&copy; 2024 SonicStream. All rights reserved.</p>
            <div className="footer-links">
              <a href="#terms">Terms of Service</a>
              <a href="#privacy">Privacy Policy</a>
              <a href="#contact">Contact Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default History;
