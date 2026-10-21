import axios from "axios";

const baseURL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

const TOKEN_KEY = "equipment_monitor_access_token";

const api = axios.create({
  baseURL,
  timeout: 15000,
});

// Recupera o token da sessão atual do navegador.
export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// Salva o token após um login bem-sucedido.
export function setAccessToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

// Remove o token ao encerrar a sessão.
export function clearAccessToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// Inclui o JWT nas requisições HTTP quando existir uma sessão.
api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Encerra a sessão quando uma rota protegida rejeita o JWT.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? "";
    const isLoginRequest = requestUrl.endsWith("/auth/login");

    if (status === 401 && !isLoginRequest) {
      clearAccessToken();

      window.dispatchEvent(new Event("equipment-monitor:session-expired"));
    }

    return Promise.reject(error);
  },
);

// Realiza o login. Esse endpoint não exige um JWT anterior.
export async function login(email, password) {
  const response = await api.post("/auth/login", {
    email,
    password,
  });

  return response.data;
}

export async function getDevices() {
  const response = await api.get("/devices");
  return response.data;
}

export function getWebSocketUrl() {
  const url = new URL(baseURL);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname}/ws`.replace(/\/+/g, "/");
  url.search = "";
  url.hash = "";

  return url.toString();
}

export async function createDevice(deviceData) {
  const response = await api.post("/devices", deviceData);
  return response.data;
}

export default api;
