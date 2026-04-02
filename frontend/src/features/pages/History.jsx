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

  const formatDate = (rawDate) => {
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="history-page">
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
              <h1>Download History</h1>
              <p className="subtitle">
                Browse, search, and redownload your recently converted tracks.
              </p>
            </div>

            <div className="search-wrapper">
              <input
                className="search-input"
                value={searchTerm}
                onChange={(e) => {
                  setCurrentPage(1);
                  setSearchTerm(e.target.value);
                }}
                placeholder="Search by title"
              />
              <FiSearch className="search-icon" />
            </div>
          </div>

          <div className="table-wrapper">
            <table className="downloads-table">
              <thead>
                <tr>
                  <th className="video-col">Video</th>
                  <th className="size-col">Size</th>
                  <th className="date-col">Date</th>
                  <th className="action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentDownloads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="no-data">
                      {isLoading
                        ? "Loading history..."
                        : "No downloads found for this search."}
                    </td>
                  </tr>
                ) : (
                  currentDownloads.map((item) => (
                    <tr
                      key={item._id || `${item.url}-${item.date}`}
                      className="download-row"
                    >
                      <td>
                        <div className="video-info">
                          <div className="thumbnail-wrapper">
                            <img
                              className="thumbnail"
                              src={item.thumbnail || "/default-thumb.svg"}
                              alt={item.title || "Video thumbnail"}
                            />
                            <span className="duration">
                              {item.duration || "--:--"}
                            </span>
                          </div>
                          <div className="video-details">
                            <p className="title">{item.title || "Untitled"}</p>
                            <p className="channel">
                              {item.quality || "320kbps"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="size-cell">{item.size || "--"}</td>
                      <td className="date-cell">{formatDate(item.date)}</td>
                      <td>
                        <button
                          className="redownload-btn"
                          onClick={() =>
                            handleRedownload(
                              item.url,
                              (item.quality || "320").replace("kbps", ""),
                            )
                          }
                        >
                          <FiDownload className="download-icon" />
                          Redownload
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-wrapper">
            <p className="pagination-info">
              Showing {currentDownloads.length} of {filteredDownloads.length}{" "}
              items
            </p>

            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
                aria-label="Previous page"
              >
                <FiArrowLeft />
              </button>

              {Array.from({ length: totalPages }).map((_, index) => {
                const page = index + 1;
                return (
                  <button
                    key={page}
                    className={`pagination-btn ${safePage === page ? "active" : ""}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                className="pagination-btn"
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage === totalPages}
                aria-label="Next page"
              >
                <FiArrowRight />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default History;
