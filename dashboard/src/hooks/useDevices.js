import { useCallback, useEffect, useState } from "react";

import {
  clearAccessToken,
  getAccessToken,
  getDevices,
  getWebSocketUrl,
} from "../services/api";

const RECONNECT_DELAY_MS = 3000;
const REFRESH_INTERVAL_MS = 30000;

export function useDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      const data = await getDevices();

      if (!Array.isArray(data)) {
        throw new Error("A API retornou um formato inesperado.");
      }

      setDevices(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Erro ao carregar equipamentos:", err);

      setError(
        "Não foi possível atualizar os equipamentos. Verifique a conexão com o servidor.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let websocket = null;
    let reconnectTimeoutId = null;
    let refreshIntervalId = null;

    function expireSession() {
      clearAccessToken();

      window.dispatchEvent(new Event("equipment-monitor:session-expired"));
    }

    function scheduleReconnect() {
      if (!active || reconnectTimeoutId !== null || !getAccessToken()) {
        return;
      }

      reconnectTimeoutId = window.setTimeout(() => {
        reconnectTimeoutId = null;
        connectWebSocket();
      }, RECONNECT_DELAY_MS);
    }

    function connectWebSocket() {
      if (!active) {
        return;
      }

      const token = getAccessToken();

      if (!token) {
        return;
      }

      try {
        websocket = new WebSocket(getWebSocketUrl());
      } catch (err) {
        console.error("Não foi possível iniciar o WebSocket:", err);

        scheduleReconnect();
        return;
      }

      websocket.onopen = () => {
        if (!active || !getAccessToken()) {
          websocket?.close();
          return;
        }

        websocket.send(
          JSON.stringify({
            type: "authenticate",
            token,
          }),
        );
      };

      websocket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.event === "authenticated") {
            console.info("WebSocket autenticado.");
            return;
          }

          if (payload.event !== "device_status_changed") {
            return;
          }

          setDevices((currentDevices) =>
            currentDevices.map((device) =>
              String(device.id) === String(payload.device_id)
                ? {
                    ...device,
                    status: payload.status,
                  }
                : device,
            ),
          );
        } catch (err) {
          console.error("Erro ao processar evento WebSocket:", err);
        }
      };

      websocket.onerror = () => {
        console.warn("Erro na conexão WebSocket.");
      };

      websocket.onclose = (event) => {
        websocket = null;

        if (!active) {
          return;
        }

        if (event.code === 4401) {
          console.warn(
            "WebSocket recusado: autenticação inválida ou expirada.",
          );

          expireSession();
          return;
        }

        scheduleReconnect();
      };
    }

    const initialRefreshTimeoutId = window.setTimeout(() => {
      if (active) {
        refresh();
      }
    }, 0);

    refreshIntervalId = window.setInterval(() => {
      if (active) {
        refresh();
      }
    }, REFRESH_INTERVAL_MS);

    connectWebSocket();

    return () => {
      active = false;

      window.clearTimeout(initialRefreshTimeoutId);

      if (refreshIntervalId !== null) {
        window.clearInterval(refreshIntervalId);
      }

      if (reconnectTimeoutId !== null) {
        window.clearTimeout(reconnectTimeoutId);
      }

      if (websocket !== null) {
        websocket.onclose = null;
        websocket.close();
      }
    };
  }, [refresh]);

  return {
    devices,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  };
}
