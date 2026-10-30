import { useState } from "react";
import { login, setAccessToken } from "./services/api";

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const response = await login(email.trim(), password);

      if (!response.access_token) {
        throw new Error("A resposta do servidor não contém um token.");
      }

      setAccessToken(response.access_token);

      onLoginSuccess({
        id: response.user_id,
        name: response.name,
        email: response.email,
      });
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        setError("E-mail ou senha inválidos.");
      } else if (status === 422) {
        setError("Confira o formato do e-mail e os dados informados.");
      } else if (!err.response) {
        setError(
          "Não foi possível conectar ao servidor. Verifique se a API está disponível.",
        );
      } else {
        setError("Não foi possível iniciar a sessão. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Acesso ao monitoramento">
        <div className="login-brand">
          <img src="/asaph.png" alt="Logo ASAPH" className="login-logo" />
          <img src="/gp.png" alt="Logo GRUPO PLENO" className="login-logo" />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="seu.email@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={255}
              required
              disabled={submitting}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Senha</label>

            <div className="password-wrapper">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                maxLength={128}
                required
                disabled={submitting}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                disabled={submitting}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? "Autenticando..." : "Entrar"}
          </button>
        </form>

        <p className="login-footer">Monitoramento de dispositivos</p>
      </section>
    </main>
  );
}

export default Login;