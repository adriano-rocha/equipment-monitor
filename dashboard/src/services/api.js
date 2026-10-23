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

export async function updateDevice(deviceId, deviceData) {
  const response = await api.patch(`/devices/${deviceId}`, deviceData);
  return response.data;
}

export async function deleteDevice(deviceId) {
  const response = await api.delete(`/devices/${deviceId}`);
  return response.data;
}

// --- Eventos ---
export async function getEvents() {
  const response = await api.get("/events");
  return response.data;
}

export async function getEvent(eventId) {
  const response = await api.get(`/events/${eventId}`);
  return response.data;
}

export async function createEvent(eventData) {
  const response = await api.post("/events", eventData);
  return response.data;
}

export async function updateEvent(eventId, eventData) {
  const response = await api.patch(`/events/${eventId}`, eventData);
  return response.data;
}

// --- Associações Equipamento <-> Evento (Pontos Físicos e Responsáveis) ---
export async function getEventDevices(eventId, activeOnly = true) {
  const response = await api.get(`/events/${eventId}/devices`, {
    params: { active_only: activeOnly },
  });
  return response.data;
}

export async function addDeviceToEvent(eventId, payload) {
  // payload: { device_id, location_point, assigned_user_id }
  const response = await api.post(`/events/${eventId}/devices`, payload);
  return response.data;
}

export async function updateEventDevice(eventId, deviceId, payload) {
  // payload: { location_point, assigned_user_id, clear_user }
  const response = await api.patch(
    `/events/${eventId}/devices/${deviceId}`,
    payload,
  );
  return response.data;
}

export async function removeDeviceFromEvent(eventId, deviceId) {
  const response = await api.delete(`/events/${eventId}/devices/${deviceId}`);
  return response.data;
}

// --- Usuários / Responsáveis Operacionais (Decisão C) ---
export async function getUsers() {
  const response = await api.get("/users");
  return response.data;
}

export async function createUser(userData) {
  const response = await api.post("/users", userData);
  return response.data;
}

export async function swapEventDevice(eventId, payload) {
  // 1. Desvincula o aparelho antigo com problema
  await removeDeviceFromEvent(eventId, payload.current_device_id);

  // 2. Vincula o novo aparelho no mesmo ponto físico e responsável
  return await addDeviceToEvent(eventId, {
    device_id: payload.new_device_id,
    location_point: payload.location_point || null,
    assigned_user_id: payload.assigned_user_id || null,
  });
}

export default api;
