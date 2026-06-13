import { Link, NavLink, useNavigate } from "react-router-dom";
import { Boxes, LayoutDashboard, LogOut, Server } from "lucide-react";
import { History } from "lucide-react";

function Navbar() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("jobPlatformToken");
    navigate("/login");
    window.location.reload();
  }

  return (
    <header className="navbar">
      <Link className="brand" to="/">
        <Boxes size={22} />
        Job Platform
      </Link>
      <nav>
        <NavLink to="/">
          <LayoutDashboard size={16} />
          Dashboard
        </NavLink>
        <NavLink to="/jobs">
          <Boxes size={16} />
          Jobs
        </NavLink>
        <NavLink to="/workers">
          <Server size={16} />
          Workers
        </NavLink>
        <NavLink to="/history">
          <History size={16} />
          History
        </NavLink>
      </nav>
      <button className="ghost-button" type="button" onClick={logout}>
        <LogOut size={16} />
        Logout
      </button>
    </header>
  );
}

export default Navbar;
