import { useContext } from "react";
import DownloadContext from "../download.context";

/**
 * Custom hook to use download context
 * @returns {object} Download context object with all state and functions
 */
export const useDownlod = () => {
    const context = useContext(DownloadContext);

    if (!context) {
        throw new Error("useDownlod must be used within DownloadProvider");
    }

    return context;
};

export default useDownlod;
