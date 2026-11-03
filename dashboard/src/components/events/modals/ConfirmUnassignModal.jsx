import { useState } from "react";
import { removeDeviceFromEvent } from "../../../services/api";

export function ConfirmUnassignModal({
  eventId,
  eventDevice,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !eventDevice) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setErrorMsg("");
    try {
      await removeDeviceFromEvent(eventId, eventDevice.device_id);
      onSuccess();
    } catch {
      setErrorMsg("Erro ao desvincular equipamento.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Desvincular Equipamento</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && <div className="modal-error">{errorMsg}</div>}
        <p style={{ color: "#e2e8f0" }}>
          Deseja desvincular este equipamento do evento? O histórico da
          associação será preservado para auditoria.
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
          <button
            type="button"
            className="btn-danger"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Desvinculando..." : "Sim, Desvincular"}
          </button>
        </div>
      </div>
    </div>
  );
}