export function AlertBanner({ alerts, onDismiss, onAction }) {
  if (!alerts || alerts.length === 0) return null;

  // Limita a exibição visual a no máximo 2 alertas para nunca cobrir a tela
  const visibleAlerts = alerts.slice(0, 2);
  const remainingCount = alerts.length - visibleAlerts.length;

  function getAlertDetails(alert) {
    switch (alert.reason) {
      case "PERIMETER_BREACH":
        return {
          title: "FORA DO PERÍMETRO",
          titleColor: "#f87171",
          borderColor: "#ef4444",
          bgColor: "#450a0a",
          actionLabel: "Ver",
          icon: "🚨",
        };
      case "HIGH_SPEED_EVASION":
        return {
          title: "DESLOCAMENTO RÁPIDO",
          titleColor: "#fb923c",
          borderColor: "#f97316",
          bgColor: "#431407",
          actionLabel: "Ver",
          icon: "⚡",
        };
      case "BATTERY_CRITICAL":
      default:
        return {
          title: "BATERIA CRÍTICA (≤10%)",
          titleColor: "#f87171",
          borderColor: "#ef4444",
          bgColor: "#450a0a",
          actionLabel: "Trocar",
          icon: "🔋",
        };
    }
  }

  function handleActionClick(alert) {
    let eventName = alert.event_name || alert.eventName || "";
    if (!eventName && alert.location_point && alert.location_point.includes("(")) {
      const matchPoint = alert.location_point.match(/\(([^)]+)\)/);
      if (matchPoint) eventName = matchPoint[1].trim();
    }
    if (!eventName && alert.message) {
      const matchMsg = alert.message.match(/evento\s+([^!.]+)/i);
      if (matchMsg) eventName = matchMsg[1].trim();
    }

    let assetNumber = alert.asset_number || alert.device_name || alert.serial_number || "";
    if (!assetNumber && alert.message) {
      const matchDev = alert.message.match(/dispositivo\s+([^\s!]+)/i);
      if (matchDev) assetNumber = matchDev[1].trim();
    }
    if (!assetNumber) assetNumber = "SIM-RASTREIO";

    const devId = alert.device_id || alert.deviceId;

    // Garante compatibilidade total com qualquer componente que consumir a ação
    const normalizedAlert = {
      ...alert,
      device_id: devId,
      deviceId: devId,
      asset_number: assetNumber,
      assetNumber: assetNumber,
      event_id: alert.event_id || alert.eventId,
      eventId: alert.event_id || alert.eventId,
      event_name: eventName,
      eventName: eventName,
      location_point: alert.location_point,
    };

    onAction(normalizedAlert);
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        maxWidth: "340px",
        width: "calc(100% - 2rem)",
      }}
      role="alert"
      aria-live="assertive"
    >
      {visibleAlerts.map((alert, idx) => {
        const details = getAlertDetails(alert);
        const displayName = alert.asset_number || alert.device_name || alert.serial_number || "SIM-RASTREIO";
        const postName = alert.location_point ? alert.location_point.split("(")[0].trim() : "Posto";

        return (
          <div
            key={`${alert.device_id || idx}-${alert.reason || "alert"}`}
            style={{
              background: "rgba(30, 10, 10, 0.95)",
              backdropFilter: "blur(8px)",
              border: `1px solid ${details.borderColor}`,
              borderLeft: `4px solid ${details.borderColor}`,
              borderRadius: "6px",
              padding: "8px 12px",
              color: "#fecaca",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            {/* Linha 1: Ícone + Título + Botão Fechar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontWeight: "700",
                  fontSize: "0.75rem",
                  color: details.titleColor,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  letterSpacing: "0.03em",
                }}
              >
                <span>{details.icon}</span>
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
                  fontSize: "0.85rem",
                  lineHeight: 1,
                  padding: "2px 4px",
                }}
                title="Dispensar alerta"
              >
                ✕
              </button>
            </div>

            {/* Linha 2: Dispositivo + Posto + Botão de Ação Rápido (Inline) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "2px",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#f3f4f6" }}>
                <strong style={{ color: "#ffffff", fontSize: "0.85rem" }}>{displayName}</strong>
                <span style={{ color: "#94a3b8", fontSize: "0.75rem", marginLeft: "6px" }}>
                  • {postName}
                </span>
                {alert.battery_level !== undefined && alert.reason === "BATTERY_CRITICAL" && (
                  <span style={{ color: "#facc15", fontWeight: "bold", marginLeft: "6px" }}>
                    ({alert.battery_level}%)
                  </span>
                )}
              </div>

              <button
                type="button"
                style={{
                  background: details.borderColor,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
                onClick={() => handleActionClick(alert)}
              >
                {details.actionLabel}
              </button>
            </div>
          </div>
        );
      })}

      {/* Indicador sutil caso haja mais de 2 alertas ativos */}
      {remainingCount > 0 && (
        <div
          style={{
            fontSize: "0.7rem",
            color: "#cbd5e1",
            textAlign: "right",
            paddingRight: "4px",
          }}
        >
          +{remainingCount} outro{remainingCount > 1 ? "s" : ""} alerta{remainingCount > 1 ? "s" : ""} ativo{remainingCount > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

export default AlertBanner;