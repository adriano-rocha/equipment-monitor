import { useEffect, useMemo, useRef, useState } from "react";
import { addDeviceToEvent } from "../../../services/api";

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

            {/* Menu Suspenso de Resultados */}
            {isDropdownOpen && (
              <ul
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  maxHeight: "210px",
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
                    const isSelected = d.id === deviceId;
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
                        <div>
                          <strong style={{ color: "#38bdf8" }}>
                            {d.asset_number}
                          </strong>
                          <span
                            style={{ color: "#94a3b8", marginLeft: "6px" }}
                          >
                            — {d.device_type || "smartphone"}
                          </span>
                        </div>
                        {isSelected && (
                          <span
                            style={{ color: "#10b981", fontWeight: "bold" }}
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

          {/* Campo de Posto Físico */}
          <div className="form-group">
            <label>Ponto Físico / Posto Operacional</label>
            <input
              type="text"
              placeholder="Ex: Entrada VIP, Docas, Palco Principal, Credenciamento..."
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