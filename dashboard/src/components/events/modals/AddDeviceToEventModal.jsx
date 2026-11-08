import { useState } from "react";
import { addDeviceToEvent } from "../../../services/api";

export function AddDeviceToEventModal({ event, devices, isOpen, onClose, onSuccess }) {
  const [deviceId, setDeviceId] = useState("");
  const [locationPoint, setLocationPoint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !event) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!deviceId) {
      setErrorMsg("Selecione um dispositivo.");
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
      setDeviceId("");
      setLocationPoint("");
      onSuccess();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail || "Erro ao vincular dispositivo ao evento."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Vincular Dispositivo ao Posto</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && <div className="modal-error">{errorMsg}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>
              Dispositivo <span className="required">*</span>
            </label>
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              required
            >
              <option value="">Selecione um dispositivo...</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.device_type ?? "Dispositivo"} — {d.asset_number}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Ponto Físico / Posto Operacional</label>
            <input
              type="text"
              placeholder="Ex: Entrada VIP, Docas, Palco Principal, Credenciamento..."
              value={locationPoint}
              onChange={(e) => setLocationPoint(e.target.value)}
              autoFocus
            />
          </div>

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
              {submitting ? "Vinculando..." : "Vincular ao Posto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}