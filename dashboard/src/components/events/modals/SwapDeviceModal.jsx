import { useEffect, useMemo, useRef, useState } from "react";
import { swapEventDevice } from "../../../services/api";

export function SwapDeviceModal({
  eventId,
  currentDevice,
  devices = [],
  isOpen,
  onClose,
  onSuccess,
}) {
  const [newDeviceId, setNewDeviceId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  // Filtra para remover o aparelho que já está no posto atualmente
  const candidateDevices = useMemo(() => {
    if (!currentDevice) return devices;
    return devices.filter((d) => d.id !== currentDevice.device_id);
  }, [devices, currentDevice]);

  // Filtro preditivo em tempo real por patrimônio ou tipo
  const filteredDevices = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return candidateDevices.slice(0, 30);

    return candidateDevices.filter((d) => {
      const asset = String(d.asset_number || "").toLowerCase();
      const type = String(d.device_type || "smartphone").toLowerCase();
      return asset.includes(term) || type.includes(term);
    });
  }, [candidateDevices, searchQuery]);

  function resetForm() {
    setNewDeviceId("");
    setSearchQuery("");
    setIsDropdownOpen(false);
    setErrorMsg("");
  }

  function handleCloseModal() {
    resetForm();
    onClose();
  }

  function handleSelectDevice(device) {
    setNewDeviceId(device.id);
    setSearchQuery(
      `${device.asset_number} — ${device.device_type || "smartphone"}`
    );
    setIsDropdownOpen(false);
    setErrorMsg("");
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setSearchQuery(val);
    setNewDeviceId("");
    setIsDropdownOpen(true);
  }

  function handleClearSelection() {
    setSearchQuery("");
    setNewDeviceId("");
    setIsDropdownOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newDeviceId) {
      setErrorMsg("Selecione um dispositivo substituto da lista.");
      setIsDropdownOpen(true);
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      await swapEventDevice(eventId, {
        event_id: eventId,
        current_device_id: currentDevice.device_id,
        new_device_id: newDeviceId,
        location_point: currentDevice.location_point,
        assigned_user_id: null,
      });
      resetForm();
      onSuccess();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail || "Erro ao realizar substituição no ponto."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen || !currentDevice) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>🔄 Substituição de Dispositivo no Ponto</h3>
          <button type="button" className="close-btn" onClick={handleCloseModal}>
            ✕
          </button>
        </div>

        {errorMsg && <div className="modal-error">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <p style={{ color: "#e2e8f0", fontSize: "0.9rem" }}>
            Substituir o dispositivo atual no ponto:{" "}
            <strong style={{ color: "#38bdf8" }}>
              {currentDevice.location_point || "Ponto Atual"}
            </strong>
          </p>

          {/* Campo Autocomplete Inteligente */}
          <div
            className="form-group"
            ref={dropdownRef}
            style={{ position: "relative" }}
          >
            <label>
              Selecione o dispositivo que assumirá este posto{" "}
              <span className="required">*</span>
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
                placeholder="Digite o patrimônio do substituto (ex: 48...)"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => setIsDropdownOpen(true)}
                required
                autoComplete="off"
                style={{
                  width: "100%",
                  paddingRight: searchQuery ? "2.2rem" : "0.75rem",
                  borderColor: newDeviceId ? "#10b981" : undefined,
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
                    color: "#94a3b8",
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
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  marginTop: "4px",
                  padding: 0,
                  listStyle: "none",
                  zIndex: 9999,
                  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.6)",
                }}
              >
                {filteredDevices.length > 0 ? (
                  filteredDevices.map((d) => {
                    const isSelected = d.id === newDeviceId;
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
                          borderBottom: "1px solid #1e293b",
                          background: isSelected
                            ? "rgba(56, 189, 248, 0.18)"
                            : "transparent",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          color: "#f8fafc",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "#1e293b";
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
                          <strong style={{ color: "#38bdf8" }}>
                            {d.asset_number}
                          </strong>
                          <span style={{ color: "#94a3b8" }}>
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
                                  ? "rgba(239, 68, 68, 0.18)"
                                  : isMedium
                                  ? "rgba(245, 158, 11, 0.18)"
                                  : "rgba(16, 185, 129, 0.18)",
                                color: isLow
                                  ? "#ef4444"
                                  : isMedium
                                  ? "#f59e0b"
                                  : "#10b981",
                                border: isLow
                                  ? "1px solid rgba(239, 68, 68, 0.4)"
                                  : "none",
                              }}
                            >
                              {isLow ? "🪫" : "🔋"} {d.battery_level}%
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <span
                            style={{
                              color: "#10b981",
                              fontWeight: "bold",
                              marginLeft: "8px",
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </li>
                    );
                  })
                ) : (
                  <li
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      color: "#94a3b8",
                      fontSize: "0.85rem",
                    }}
                  >
                    Nenhum dispositivo encontrado com "<b>{searchQuery}</b>"
                  </li>
                )}
              </ul>
            )}
          </div>

          <p style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            * O aparelho antigo será desvinculado e o substituto assumirá o
            mesmo posto mantendo a auditoria.
          </p>

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
              disabled={submitting || !newDeviceId}
            >
              {submitting ? "Substituindo..." : "Confirmar Substituição"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SwapDeviceModal;