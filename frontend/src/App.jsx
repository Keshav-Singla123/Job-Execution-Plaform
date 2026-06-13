import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Jobs from "./pages/Jobs.jsx";
import Workers from "./pages/Workers.jsx";
import History from "./pages/History.jsx";
import Login from "./pages/Login.jsx";
import useSocket from "./hooks/useSocket.js";

function App() {
  const token = localStorage.getItem("jobPlatformToken");
  useSocket(Boolean(token));

  return (
    <div className="app-shell">
      {token ? <Navbar /> : null}
      <main className="page-shell">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={token ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/jobs"
            element={token ? <Jobs /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/workers"
            element={token ? <Workers /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/history"
            element={token ? <History /> : <Navigate to="/login" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
