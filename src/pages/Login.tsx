import { useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, errorMessage } from "../api/client";

export function Login() {
  const { user, login, notice } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setSigningIn] = useState(false);
  const redirectState = location.state as { from?: string } | null;
  const returnUrl = redirectState?.from?.startsWith("/webhooks")
    ? redirectState.from
    : "/webhooks?page=1";

  if (user) {
    return <Navigate to={returnUrl} replace />;
  }

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    setSigningIn(true);
    setError("");

    try {
      await login(email, password);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? (error.body.error.payload?.password?.join(" ") ??
              errorMessage(error))
          : errorMessage(error),
      );
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <main className="login-layout">
      <div className="login-intro">
        <a className="brand" href="/">
          <span aria-hidden="true">◈</span> <span>Test work</span>
        </a>
      </div>
      <section className="login-panel">
        <form className="login-form" onSubmit={handleLogin}>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to your workspace</h2>
          <p className="muted">
            Enter your credentials to manage your endpoints.
          </p>
          {notice && (
            <p className="field-error" role="alert">
              {notice}
            </p>
          )}
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={handleEmailChange}
            disabled={isSigningIn}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={handlePasswordChange}
            disabled={isSigningIn}
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
          />
          {error && (
            <p id="login-error" className="field-error" role="alert">
              {error}
            </p>
          )}
          <button disabled={isSigningIn}>
            {isSigningIn ? "Signing in…" : "Sign in →"}
          </button>
          <aside className="demo-note">
            <strong>Try the demo workspace</strong>
            <span>test@example.com</span>
            <span>Webhook123!</span>
          </aside>
        </form>
      </section>
    </main>
  );
}
