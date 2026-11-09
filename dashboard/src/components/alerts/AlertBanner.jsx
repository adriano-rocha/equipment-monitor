export function AlertBanner({ alerts, onDismiss, onAction }) {
  if (!alerts || alerts.length === 0) return null;

  function getAlertDetails(alert) {
    switch (alert.reason) {
      case "PERIMETER_BREACH":
        return {
          title: "🔴 AFASTAMENTO DO PONTO DE COBERTURA",
          titleColor: "#f87171",
          borderColor: "#ef4444",
          bgColor: "#450a0a",
          actionLabel: "Ver no Posto",
          badgeColor: "#ef4444",
        };
      case "HIGH_SPEED_EVASION":
        return {
          title: "🚨 DESLOCAMENTO RÁPIDO DETECTADO",
          titleColor: "#fb923c",
          borderColor: "#f97316",
          bgColor: "#431407",
          actionLabel: "Ver no Posto",
          badgeColor: "#f97316",
        };
      case "BATTERY_CRITICAL":
      default:
        return {
          title: "🔋 BATERIA CRÍTICA (≤10%)",
          titleColor: "#f87171",
          borderColor: "#ef4444",
          bgColor: "#450a0a",
          actionLabel: "Substituir no Ponto",
          badgeColor: "#ef4444",
        };
    }
  }

  function handleActionClick(alert) {
    // 1. Extração do Nome do Evento (direto, via parênteses do posto ou via mensagem)
    let eventName = alert.event_name || alert.eventName || "";
    if (!eventName && alert.location_point && alert.location_point.includes("(")) {
      const matchPoint = alert.location_point.match(/\(([^)]+)\)/);
      if (matchPoint) eventName = matchPoint[1].trim();
    }
    if (!eventName && alert.message) {
      const matchMsg = alert.message.match(/evento\s+([^!.]+)/i);
      if (matchMsg) eventName = matchMsg[1].trim();
    }
    if (!eventName) eventName = "";

    // 2. Extração do Patrimônio / Nome do Aparelho
    let assetNumber = alert.asset_number || alert.device_name || alert.serial_number || "";
    if (!assetNumber && alert.message) {
      const matchDev = alert.message.match(/dispositivo\s+([^\s!]+)/i);
      if (matchDev) assetNumber = matchDev[1].trim();
    }
    if (!assetNumber) assetNumber = "SIM-RASTREIO";

    const normalizedAlert = {
      ...alert,
      device_id: alert.device_id || alert.deviceId,
      asset_number: assetNumber,
      event_id: alert.event_id || alert.eventId,
      event_name: eventName,
      location_point: alert.location_point,
    };

    onAction(normalizedAlert);
  }

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
        maxWidth: "440px",
        width: "100%",
      }}
      role="alert"
      aria-live="assertive"
    >
      {alerts.map((alert, idx) => {
        const details = getAlertDetails(alert);
        const displayName = alert.asset_number || alert.device_name || alert.serial_number || "SIM-RASTREIO";

        return (
          <div
            key={`${alert.device_id || idx}-${alert.reason || "alert"}`}
            style={{
              background: details.bgColor,
              border: `2px solid ${details.borderColor}`,
              borderRadius: "8px",
              padding: "1rem",
              color: "#fecaca",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              animation: "fadeIn 0.3s ease-in-out",
            }}
          >
            {/* Cabeçalho do Card */}
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
                  color: details.titleColor,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  letterSpacing: "0.025em",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: details.badgeColor,
                    boxShadow: `0 0 8px ${details.badgeColor}`,
                  }}
                />
                {details.title}
              </span>

              <button
                type="button"
                onClick={() => onDismiss(alert.device_id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  lineHeight: 1,
                  padding: "0.2rem",
                }}
                title="Dispensar alerta"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo / Mensagem */}
            <div style={{ fontSize: "0.9rem", color: "#f3f4f6" }}>
              <div>
                Dispositivo:{" "}
                <strong style={{ color: "#fff" }}>{displayName}</strong>
              </div>

              {alert.message && (
                <div
                  style={{
                    color: "#fecaca",
                    fontSize: "0.85rem",
                    marginTop: "0.35rem",
                    lineHeight: 1.4,
                  }}
                >
                  {alert.message}
                </div>
              )}

              {alert.battery_level !== undefined &&
                alert.reason !== "PERIMETER_BREACH" && (
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
                    marginTop: "0.35rem",
                  }}
                >
                  📍 Posto: <b>{alert.location_point}</b>{" "}
                  {alert.event_name ? `(${alert.event_name})` : ""}
                </div>
              )}
            </div>

            {/* Ação Operacional */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "0.35rem",
              }}
            >
              <button
                type="button"
                className="btn-danger"
                style={{
                  padding: "0.45rem 0.9rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => handleActionClick(alert)}
              >
                {details.actionLabel}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AlertBanner;