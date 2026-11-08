import { useState } from "react";
import { deleteEvent } from "../../../services/api";

export function ConfirmDeleteEventModal({ event, isOpen, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !event) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setErrorMsg("");
    try {
      await deleteEvent(event.id);
      onSuccess();
    } catch {
      setErrorMsg("Erro ao excluir o evento. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Confirmar Exclusão de Evento</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && (
          <div className="modal-error" role="alert">
            {errorMsg}
          </div>
        )}
        <p style={{ color: "#e2e8f0", fontSize: "0.95rem", lineHeight: 1.5 }}>
          Tem certeza que deseja excluir o evento{" "}
          <strong style={{ color: "#38bdf8" }}>{event.name}</strong>?
        </p>
        <div className="warning-banner" style={{ marginTop: "1rem" }}>
          <strong>Atenção:</strong> O evento será removido e todas as
          associações de postos e dispositivos deste evento serão desfeitas.
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
          <button
            type="button"
            className="btn-danger"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Excluindo..." : "Sim, Excluir Evento"}
          </button>
        </div>
      </div>
    </div>
  );
}