import { useEffect, useMemo, useRef, useState } from "react";
import { addDeviceToEvent, getEventDevices } from "../../../services/api";

export function AddDeviceToEventModal({
  event,
  devices = [],
  isOpen,
  onClose,
  onSuccess,
}) {
  const [deviceId, setDeviceId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [locationPoint, setLocationPoint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Sugestões 100% dinâmicas extraídas dos postos já ativos deste evento
  const [suggestedPoints, setSuggestedPoints] = useState([]);

  useEffect(() => {
    if (!isOpen || !event?.id) return;
    getEventDevices(event.id, true)
      .then((activeDevs) => {
        if (Array.isArray(activeDevs)) {
          const points = Array.from(
            new Set(
              activeDevs
                .map((ed) => ed.location_point?.trim())
                .filter(Boolean)
            )
          );
          if (points.length > 0) {
            setSuggestedPoints(points);
          }
        }
      })
      .catch(() => {});
  }, [isOpen, event?.id]);

  const dropdownRef = useRef(null);

  // Fecha o menu suspenso ao clicar fora dele
  useEffect(() => {
    if (!isOpen || !isDropdownOpen) return;

    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, isDropdownOpen]);

  // Filtro preditivo em tempo real por patrimônio ou tipo
  const filteredDevices = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return devices.slice(0, 30);

    return devices.filter((d) => {
      const asset = String(d.asset_number || "").toLowerCase();
      const type = String(d.device_type || "smartphone").toLowerCase();
      return asset.includes(term) || type.includes(term);
    });
  }, [devices, searchQuery]);

  function resetForm() {
    setDeviceId("");
    setSearchQuery("");
    setLocationPoint("");
    setIsDropdownOpen(false);
    setErrorMsg("");
  }

  function handleCloseModal() {
    resetForm();
    onClose();
  }

  function handleSelectDevice(device) {
    setDeviceId(device.id);
    setSearchQuery(
      `${device.asset_number} — ${device.device_type || "smartphone"}`
    );
    setIsDropdownOpen(false);
    setErrorMsg("");
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setSearchQuery(val);
    setDeviceId("");
    setIsDropdownOpen(true);
  }

  function handleClearSelection() {
    setSearchQuery("");
    setDeviceId("");
    setIsDropdownOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!deviceId) {
      setErrorMsg("Selecione um dispositivo válido da lista.");
      setIsDropdownOpen(true);
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      await addDeviceToEvent(event.id, {
        device_id: deviceId,
        location_point: locationPoint.trim() || null,
        assigned_user_id: null,
      });
      resetForm();
      onSuccess();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail || "Erro ao vincular dispositivo ao evento."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen || !event) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Vincular Dispositivo ao Posto</h3>
          <button type="button" className="close-btn" onClick={handleCloseModal}>
            ✕
          </button>
        </div>

        {errorMsg && <div className="modal-error">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Campo Autocomplete Inteligente */}
          <div
            className="form-group"
            ref={dropdownRef}
            style={{ position: "relative" }}
          >
            <label>
              Dispositivo <span className="required">*</span>
            </label>

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="Digite o patrimônio (ex: 48...)"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => setIsDropdownOpen(true)}
                required
                autoComplete="off"
                style={{
                  width: "100%",
                  paddingRight: searchQuery ? "2.2rem" : "0.75rem",
                  borderColor: deviceId ? "#10b981" : undefined,
                }}
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  style={{
                    position: "absolute",
                    right: "0.6rem",
                    background: "transparent",
                    border: "none",
                    color: "var(--color-muted)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    padding: "0.2rem 0.4rem",
                  }}
                  title="Limpar seleção"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Menu Suspenso de Resultados com Destaque de Bateria */}
            {isDropdownOpen && (
              <ul
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  maxHeight: "220px",
                  overflowY: "auto",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  marginTop: "4px",
                  padding: 0,
                  listStyle: "none",
                  zIndex: 9999,
                  boxShadow: "none",
                }}
              >
                {filteredDevices.length > 0 ? (
                  filteredDevices.map((d) => {
                    const isSelected = d.id === deviceId;
                    const hasBattery = typeof d.battery_level === "number";
                    const isLow = hasBattery && d.battery_level <= 20;
                    const isMedium =
                      hasBattery && d.battery_level > 20 && d.battery_level <= 40;

                    return (
                      <li
                        key={d.id}
                        onClick={() => handleSelectDevice(d)}
                        style={{
                          padding: "0.65rem 0.9rem",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                          borderBottom: "1px solid var(--color-border)",
                          background: isSelected
                            ? "rgba(16, 185, 129, 0.1)"
                            : "transparent",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          color: "var(--color-text)",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "#22272e";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong style={{ color: "#c9d1d9" }}>
                            {d.asset_number}
                          </strong>
                          <span style={{ color: "var(--color-muted)" }}>
                            — {d.device_type || "smartphone"}
                          </span>

                          {/* Badge de Bateria Inteligente */}
                          {hasBattery && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                padding: "2px 7px",
                                borderRadius: "4px",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                background: isLow
                                  ? "rgba(248, 113, 113, 0.12)"
                                  : isMedium
                                    ? "rgba(210, 153, 34, 0.12)"
                                    : "#1a1d21",
                                color: isLow
                                  ? "#f87171"
                                  : isMedium
                                    ? "#d29922"
                                    : "var(--color-text)",
                                border: isLow
                                  ? "1px solid rgba(248, 113, 113, 0.3)"
                                  : "1px solid var(--color-border)",
                              }}
                            >
                              {d.battery_level}%
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <span className="selected-device-tag">Selecionado</span>
                        )}
                      </li>
                    );
                  })
                ) : (
                  <li
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      color: "var(--color-muted)",
                      fontSize: "0.85rem",
                    }}
                  >
                    Nenhum dispositivo encontrado com "<b>{searchQuery}</b>"
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Campo de Posto Físico com Sugestões de Clique Rápido */}
          <div className="form-group">
            <label>Ponto Físico / Posto Operacional</label>

            {/* Chips dinâmicos com os postos ativos */}
            {suggestedPoints.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  marginBottom: "8px",
                }}
              >
                {suggestedPoints.map((pt) => {
                  const isSelected = locationPoint === pt;
                  return (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setLocationPoint(pt)}
                      style={{
                        background: isSelected
                          ? "rgba(16, 185, 129, 0.12)"
                          : "#1a1d21",
                        color: isSelected ? "#10b981" : "#c9d1d9",
                        border: isSelected
                          ? "1px solid #10b981"
                          : "1px solid #2d333b",
                        borderRadius: "4px",
                        padding: "4px 9px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {pt}
                    </button>
                  );
                })}
              </div>
            )}

            <input
              type="text"
              placeholder="Ex: Recepcionista, Volante, Entrada, Sala VIP..."
              value={locationPoint}
              onChange={(e) => setLocationPoint(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !deviceId}
            >
              {submitting ? "Vinculando..." : "Vincular ao Posto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddDeviceToEventModal;