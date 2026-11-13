import { useState } from "react";
import { updateEventDevice } from "../../../services/api";

export function MoveDeviceModal({ eventId, eventDevice, isOpen, onClose, onSuccess }) {
  const [locationPoint, setLocationPoint] = useState(
    () => eventDevice?.location_point || ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !eventDevice) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    try {
      await updateEventDevice(eventId, eventDevice.device_id, {
        location_point: locationPoint.trim() || null,
        assigned_user_id: null,
        clear_user: true,
      });
      onSuccess();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Erro ao mover dispositivo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Mover Ponto Físico</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && <div className="modal-error">{errorMsg}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Novo Ponto Físico</label>
            <input
              type="text"
              placeholder="Ex: Sala de Controle, Docas, Entrada..."
              value={locationPoint}
              onChange={(e) => setLocationPoint(e.target.value)}
              autoFocus
            />
          </div>

          <p
            style={{
              color: "var(--color-muted)",
              fontSize: "0.85rem",
              marginTop: "0.5rem",
            }}
          >
            * Esta ação atualiza a localização do aparelho mantendo o histórico
            de auditoria do evento.
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
              {submitting ? "Salvando..." : "Confirmar Movimentação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}