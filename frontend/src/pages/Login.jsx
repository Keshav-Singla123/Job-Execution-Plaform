import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { LogIn, UserPlus } from "lucide-react";
import { login, register } from "../api/index.js";

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [confirmPassword, setConfirmPassword] = useState("password123");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      if (mode === "register") {
        if (!name.trim()) {
          toast.error("Name is required");
          return;
        }

        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }

        const data = await register({ name, email, password });
        localStorage.setItem("jobPlatformToken", data.token);
        toast.success("Account created and signed in.");
        navigate("/");
        window.location.reload();
        return;
      }

      const data = await login({ email, password });
      localStorage.setItem("jobPlatformToken", data.token);
      toast.success("Signed in.");
      navigate("/");
      window.location.reload();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <section className="login-shell">
      <form className="login-panel" onSubmit={handleSubmit}>
        <h1>{mode === "login" ? "Login" : "Create Account"}</h1>
        <div className="auth-toggle">
          <button
            type="button"
            className={mode === "login" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "register" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        {mode === "register" ? (
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {mode === "register" ? (
          <div className="field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
        ) : null}

        <button className="primary-button" type="submit">
          {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
          {mode === "login" ? "Login" : "Register"}
        </button>

        <p className="auth-hint">
          {mode === "login"
            ? "New user? Switch to Register to create an account."
            : "Already have an account? Switch back to Login."}
        </p>
      </form>
    </section>
  );
}

export default Login;
