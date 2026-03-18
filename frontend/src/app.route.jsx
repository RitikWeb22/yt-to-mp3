import { createBrowserRouter } from "react-router-dom";
import Home from "./features/pages/Home";
import History from "./features/pages/History";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/history",
    element: <History />,
  },
]);
