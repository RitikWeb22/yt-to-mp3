import { RouterProvider } from "react-router-dom";
import { router } from "./app.route";
import { DownloadProvider } from "./features/download.context";
const App = () => {
  return (
    <DownloadProvider>
      <RouterProvider router={router} />
    </DownloadProvider>
  );
};
export default App;
