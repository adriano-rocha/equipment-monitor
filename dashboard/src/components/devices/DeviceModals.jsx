import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createDevice, deleteDevice, updateDevice } from "../../services/api";

// ----------------------------------------------------------------------------
// MODAL: CADASTRAR EQUIPAMENTO
// ----------------------------------------------------------------------------
export function CreateDeviceModal({ isOpen, onClose, onSuccess }) {
  const [assetNumber, setAssetNumber] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    const trimmedAsset = assetNumber.trim();
    if (!trimmedAsset) {
      setErrorMsg("O patrimônio é obrigatório.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        asset_number: trimmedAsset,
        device_type: deviceType || null,
        manufacturer: null,
        model: null,
        serial_number: null,
      };
      const result = await createDevice(payload);
      onSuccess(result);
    } catch (err) {
      if (err.response?.status === 409) {
        setErrorMsg("Este patrimônio já está cadastrado no sistema.");
      } else if (err.response?.data?.detail) {
        setErrorMsg(String(err.response.data.detail));
      } else {
        setErrorMsg("Erro ao cadastrar equipamento. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="modal-card"
        style={{ maxWidth: "380px", padding: "1.25rem" }}
      >
        <div className="modal-header" style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem" }}>Cadastrar Equipamento</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && (
          <div
            className="modal-error"
            role="alert"
            style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}
          >
            {errorMsg}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="modal-form"
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <div className="form-group">
            <label htmlFor="device_type" style={{ fontSize: "0.85rem" }}>
              Tipo de Equipamento
            </label>
            <select
              id="device_type"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              autoFocus
            >
              <option value="">Não informado</option>
              <option value="smartphone">Smartphone</option>
              <option value="notebook">Notebook</option>
              <option value="tablet">Tablet</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="asset_number" style={{ fontSize: "0.85rem" }}>
              Patrimônio <span className="required">*</span>
            </label>
            <input
              id="asset_number"
              type="text"
              placeholder="Ex: CEL-001"
              value={assetNumber}
              onChange={(e) => setAssetNumber(e.target.value)}
              required
            />
          </div>

          <div
            className="modal-actions"
            style={{ marginTop: "0.75rem", gap: "0.5rem" }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MODAL: EDITAR EQUIPAMENTO
// ----------------------------------------------------------------------------
export function EditDeviceModal({ device, isOpen, onClose, onSuccess }) {
  const [assetNumber, setAssetNumber] = useState(
    () => device?.asset_number || "",
  );
  const [deviceType, setDeviceType] = useState(() => device?.device_type || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !device) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    const trimmedAsset = assetNumber.trim();
    if (!trimmedAsset) {
      setErrorMsg("O patrimônio é obrigatório.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        asset_number: trimmedAsset,
        device_type: deviceType || null,
        manufacturer: device.manufacturer || null,
        model: device.model || null,
        serial_number: device.serial_number || null,
      };
      await updateDevice(device.id, payload);
      onSuccess();
    } catch (err) {
      const errorResponse = err?.response;
      if (errorResponse?.status === 409) {
        setErrorMsg("Este patrimônio já está cadastrado em outro equipamento.");
      } else if (errorResponse?.data?.detail) {
        setErrorMsg(String(errorResponse.data.detail));
      } else {
        setErrorMsg("Erro ao atualizar equipamento. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="modal-card"
        style={{ maxWidth: "380px", padding: "1.25rem" }}
      >
        <div className="modal-header">
          <h3>Editar Equipamento</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && (
          <div className="modal-error" role="alert">
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="edit_device_type">Tipo de Equipamento</label>
            <select
              id="edit_device_type"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
            >
              <option value="">Não informado</option>
              <option value="smartphone">Smartphone</option>
              <option value="notebook">Notebook</option>
              <option value="tablet">Tablet</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="edit_asset_number">
              Patrimônio <span className="required">*</span>
            </label>
            <input
              id="edit_asset_number"
              type="text"
              value={assetNumber}
              onChange={(e) => setAssetNumber(e.target.value)}
              required
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
              {submitting ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MODAL: CONFIRMAR EXCLUSÃO
// ----------------------------------------------------------------------------
export function ConfirmDeleteModal({ device, isOpen, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !device) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setErrorMsg("");
    try {
      await deleteDevice(device.id);
      onSuccess();
    } catch {
      setErrorMsg("Erro ao desativar equipamento. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Confirmar Exclusão</h3>
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
          Tem certeza que deseja desativar o equipamento{" "}
          <strong style={{ color: "#38bdf8" }}>{device.asset_number}</strong>?
        </p>
        <div className="warning-banner" style={{ marginTop: "1rem" }}>
          <strong>Atenção:</strong> O equipamento será removido da lista
          operacional e sua credencial será revogada. O histórico anterior será
          preservado.
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
            {submitting ? "Desativando..." : "Sim, Desativar Equipamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MODAL: EXIBIÇÃO DE CREDENCIAIS COM QR CODE
// ----------------------------------------------------------------------------
export function CredentialsDisplayModal({ deviceData, onClose }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!deviceData) return null;

  const { credentials, asset_number, id } = deviceData;

  const rawApiUrl =
    import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000`;

  const serverUrl = rawApiUrl.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");

  const qrPayload = JSON.stringify({
    server_url: serverUrl,
    key_id: credentials.key_id,
    secret: credentials.secret,
    asset_number,
    device_id: id || deviceData.id,
  });

  function copyToClipboard(text, setter) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  function copyBoth() {
    const text = `Patrimônio: ${asset_number}\nKey ID: ${credentials.key_id}\nSecret: ${credentials.secret}`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card modal-credentials">
        <div className="modal-header">
          <h3>Credencial do Equipamento: {asset_number}</h3>
        </div>

        <div className="warning-banner">
          <strong>Atenção:</strong> Esta é a <u>única vez</u> que o segredo (secret) será exibido.
        </div>

        {/* QR Code para Tablet / Smartphone (Samsung) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "#ffffff",
            padding: "1rem",
            borderRadius: "8px",
            margin: "1rem 0",
          }}
        >
          <QRCodeSVG
            value={qrPayload}
            size={180}
            level="M"
            includeMargin={true}
          />
          <span
            style={{
              color: "#0f172a",
              fontSize: "0.82rem",
              fontWeight: "600",
              marginTop: "0.4rem",
            }}
          >
            📱 Escaneie pelo botão do app Asaph-Track
          </span>
        </div>

        {/* Chaves manuais para o Notebook */}
        <div className="credential-field">
          <label>Identificador Público (key_id):</label>
          <div className="copy-row">
            <code>{credentials.key_id}</code>
            <button
              type="button"
              onClick={() => copyToClipboard(credentials.key_id, setCopiedKey)}
            >
              {copiedKey ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="credential-field">
          <label>Segredo (secret):</label>
          <div className="copy-row">
            <code className="secret-code">{credentials.secret}</code>
            <button
              type="button"
              onClick={() => copyToClipboard(credentials.secret, setCopiedSecret)}
            >
              {copiedSecret ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="modal-actions space-between">
          <button type="button" className="btn-secondary" onClick={copyBoth}>
            {copiedAll ? "Copiado Tudo!" : "Copiar Ambas as Chaves (Notebook)"}
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Concluir e Fechar
          </button>
        </div>
      </div>
    </div>
  );
}