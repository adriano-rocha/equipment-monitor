export function AlertBanner({ alerts, onDismiss, onAction }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        maxWidth: "420px",
        width: "100%",
      }}
      role="alert"
      aria-live="assertive"
    >
      {alerts.map((alert) => (
        <div
          key={`${alert.device_id}-${alert.reason}`}
          style={{
            background: "#450a0a",
            border: "2px solid #ef4444",
            borderRadius: "8px",
            padding: "1rem",
            color: "#fecaca",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                fontSize: "0.85rem",
                color: "#f87171",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#ef4444",
                }}
              />
              🔋 BATERIA CRÍTICA (≤10%)
            </span>
            <button
              type="button"
              onClick={() => onDismiss(alert.device_id)}
              style={{
                background: "transparent",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
              title="Dispensar alerta"
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: "0.9rem", color: "#f3f4f6" }}>
            <div>
              Equipamento:{" "}
              <strong style={{ color: "#fff" }}>{alert.asset_number}</strong>
            </div>
            {alert.battery_level !== undefined && (
              <div
                style={{
                  color: "#facc15",
                  fontWeight: "bold",
                  marginTop: "0.2rem",
                }}
              >
                Nível de Bateria: {alert.battery_level}% — Trocar imediatamente!
              </div>
            )}
            {alert.location_point && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#cbd5e1",
                  marginTop: "0.25rem",
                }}
              >
                📍 Posto: <b>{alert.location_point}</b>{" "}
                {alert.event_name ? `(${alert.event_name})` : ""}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "0.25rem",
            }}
          >
            <button
              type="button"
              className="btn-danger"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
              onClick={() => onAction(alert)}
            >
              Substituir no Ponto
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AlertBanner;