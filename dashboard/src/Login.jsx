import { useState } from "react";
import { login, setAccessToken } from "./services/api";

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <img
            src="/asaph.png"
            alt="Logo ASAPH"
            className="login-logo"
          />

          <img
            src="/gp.png"
            alt="Logo GRUPO PLENO"
            className="login-logo"
          />
          
        </div>

        <div className="login-heading">
          
          
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
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={128}
              required
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={submitting}
          >
            {submitting ? "Autenticando..." : "Entrar"}
          </button>
        </form>

        <p className="login-footer">
          Monitoramento de ativos e equipamentos
        </p>
      </section>
    </main>
  );
}

export default Login;

