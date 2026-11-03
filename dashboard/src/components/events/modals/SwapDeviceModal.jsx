import { useState } from "react";
import { swapEventDevice } from "../../../services/api";

export function SwapDeviceModal({
  eventId,
  currentDevice,
  devices,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [newDeviceId, setNewDeviceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !currentDevice) return null;

  const candidateDevices = devices.filter(
    (d) => d.id !== currentDevice.device_id
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newDeviceId) {
      setErrorMsg("Selecione um equipamento substituto.");
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
      onSuccess();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail || "Erro ao realizar substituição no ponto."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>🔄 Substituição de Equipamento no Ponto</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && <div className="modal-error">{errorMsg}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <p style={{ color: "#e2e8f0", fontSize: "0.9rem" }}>
            Substituir o equipamento atual no ponto:{" "}
            <strong style={{ color: "#38bdf8" }}>
              {currentDevice.location_point || "Ponto Atual"}
            </strong>
          </p>

          <div className="form-group">
            <label>
              Selecione o equipamento que assumirá este posto{" "}
              <span className="required">*</span>
            </label>
            <select
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              required
              autoFocus
            >
              <option value="">Selecione pelo Patrimônio...</option>
              {candidateDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.device_type ?? "Equipamento"} — {d.asset_number}
                </option>
              ))}
            </select>
          </div>

          <p style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            * O aparelho antigo será desvinculado e o substituto assumirá o
            mesmo posto mantendo a auditoria.
          </p>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Substituindo..." : "Confirmar Substituição"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}