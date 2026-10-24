import { useEffect, useMemo, useState } from "react";

import { useDevices } from "./hooks/useDevices";
import Login from "./Login";
import {
  addDeviceToEvent,
  clearAccessToken,
  createDevice,
  createEvent,
  deleteDevice,
  getAccessToken,
  getEventDevices,
  getEvents,
  getUsers,
  removeDeviceFromEvent,
  swapEventDevice,
  updateDevice,
  updateEventDevice,
} from "./services/api";

const ITEMS_PER_PAGE = 10;

const STATUS = {
  ONLINE: "ONLINE",
  WARNING: "SEM COMUNICAÇÃO",
  OFFLINE: "OFFLINE",
};

const STATUS_BADGES = {
  [STATUS.ONLINE]: { label: "ONLINE", className: "status-online" },
  [STATUS.WARNING]: {
    label: "SEM COMUNICAÇÃO",
    className: "status-warning",
  },
  [STATUS.OFFLINE]: { label: "OFFLINE", className: "status-offline" },
};

const SUMMARY_CARDS = [
  { status: STATUS.ONLINE, title: "ONLINE", className: "card-online" },
  {
    status: STATUS.WARNING,
    title: "SEM COMUNICAÇÃO",
    className: "card-warning",
  },
  { status: STATUS.OFFLINE, title: "OFFLINE", className: "card-offline" },
];

const STATUS_FILTERS = [
  { value: "TODOS", label: "Todos" },
  { value: STATUS.ONLINE, label: "Online" },
  { value: STATUS.WARNING, label: "Sem comunicação" },
  { value: STATUS.OFFLINE, label: "Offline" },
];

const brasiliaDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function formatBrasiliaDateTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  return brasiliaDateTimeFormatter.format(date);
}

function StatusBadge({ status }) {
  const config = STATUS_BADGES[status] ?? {
    label: status ?? "SEM REGISTRO",
    className: "status-unknown",
  };
  return (
    <span className={`status-badge ${config.className}`}>{config.label}</span>
  );
}

function StatusCard({ title, count, className }) {
  return (
    <div className={`status-card ${className}`}>
      <span className="status-card-title">{title}</span>
      <strong className="status-card-count">{count}</strong>
    </div>
  );
}

// ----------------------------------------------------------------------------
// COMPONENTES DE ALERTA OPERACIONAL (ETAPA 4)
// ----------------------------------------------------------------------------
function AlertBanner({ alerts, onDismiss, onAction }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        maxWidth: "420px",
        width: "100%",
      }}
      role="alert"
      aria-live="assertive"
    >
      {alerts.map((alert) => (
        <div
          key={`${alert.device_id}-${alert.reason}`}
          style={{
            background: "#450a0a",
            border: "2px solid #ef4444",
            borderRadius: "8px",
            padding: "1rem",
            color: "#fecaca",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                fontSize: "0.85rem",
                color: "#f87171",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#ef4444",
                }}
              />
              🔋 BATERIA CRÍTICA (≤10%)
            </span>
            <button
              type="button"
              onClick={() => onDismiss(alert.device_id)}
              style={{
                background: "transparent",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
              title="Dispensar alerta"
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: "0.9rem", color: "#f3f4f6" }}>
            <div>
              Equipamento:{" "}
              <strong style={{ color: "#fff" }}>{alert.asset_number}</strong>
            </div>
            {alert.battery_level !== undefined && (
              <div
                style={{
                  color: "#facc15",
                  fontWeight: "bold",
                  marginTop: "0.2rem",
                }}
              >
                Nível de Bateria: {alert.battery_level}% — Trocar imediatamente!
              </div>
            )}
            {alert.location_point && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#cbd5e1",
                  marginTop: "0.25rem",
                }}
              >
                📍 Posto: <b>{alert.location_point}</b>{" "}
                {alert.event_name ? `(${alert.event_name})` : ""}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "0.25rem",
            }}
          >
            <button
              type="button"
              className="btn-danger"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
              onClick={() => onAction(alert)}
            >
              Substituir no Ponto
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// MODAIS DE EQUIPAMENTOS
// ----------------------------------------------------------------------------
function CreateDeviceModal({ isOpen, onClose, onSuccess }) {
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

function EditDeviceModal({ device, isOpen, onClose, onSuccess }) {
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

function ConfirmDeleteModal({ device, isOpen, onClose, onSuccess }) {
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

function CredentialsDisplayModal({ deviceData, onClose }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!deviceData) return null;
  const { credentials, asset_number } = deviceData;

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
          <strong>Atenção:</strong> Esta é a <u>única vez</u> que o segredo será
          exibido. Copie e configure o agente agora.
        </div>
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
              onClick={() =>
                copyToClipboard(credentials.secret, setCopiedSecret)
              }
            >
              {copiedSecret ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
        <div className="modal-actions space-between">
          <button type="button" className="btn-secondary" onClick={copyBoth}>
            {copiedAll ? "Copiado Tudo!" : "Copiar Ambas as Chaves"}
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Concluir e Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MODAIS DE EVENTOS E PONTOS (ETAPAS 3 E 4)
// ----------------------------------------------------------------------------
function CreateEventModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    if (!name.trim() || !location.trim() || !startsAt || !endsAt) {
      setErrorMsg("Preencha todos os campos obrigatórios.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setErrorMsg("A data de término deve ser posterior à data de início.");
      return;
    }

    setSubmitting(true);
    try {
      await createEvent({
        name: name.trim(),
        location: location.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        is_active: isActive,
      });
      onSuccess();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Erro ao cadastrar evento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Novo Evento</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && <div className="modal-error">{errorMsg}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>
              Nome do Evento <span className="required">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Expo Tecnologia 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>
              Local <span className="required">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Centro de Convenções - SP"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>
                Início <span className="required">*</span>
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>
                Término <span className="required">*</span>
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </div>
          </div>
          <div
            className="form-group"
            style={{
              flexDirection: "row",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label
              htmlFor="is_active"
              style={{ marginBottom: 0, cursor: "pointer" }}
            >
              Evento ativo no momento
            </label>
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
              {submitting ? "Criando..." : "Criar Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddDeviceToEventModal({
  event,
  devices,
  users,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [deviceId, setDeviceId] = useState("");
  const [locationPoint, setLocationPoint] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !event) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!deviceId) {
      setErrorMsg("Selecione um equipamento.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      await addDeviceToEvent(event.id, {
        device_id: deviceId,
        location_point: locationPoint.trim() || null,
        assigned_user_id: assignedUserId || null,
      });
      onSuccess();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail || "Erro ao vincular equipamento ao evento.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Vincular Equipamento ao Evento</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && <div className="modal-error">{errorMsg}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>
              Equipamento <span className="required">*</span>
            </label>
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              required
            >
              <option value="">Selecione um equipamento...</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.asset_number} — {d.device_type ?? "Equipamento"} (
                  {d.model ?? d.hostname ?? "S/N"})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Ponto Físico (Localização no Evento)</label>
            <input
              type="text"
              placeholder="Ex: Entrada VIP, Docas, Palco Principal, Credenciamento..."
              value={locationPoint}
              onChange={(e) => setLocationPoint(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Responsável Operacional</label>
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
            >
              <option value="">Nenhum responsável atribuído</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
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
              {submitting ? "Vinculando..." : "Vincular Equipamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MoveDeviceModal({
  eventId,
  eventDevice,
  users,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [locationPoint, setLocationPoint] = useState(
    () => eventDevice?.location_point || "",
  );
  const [assignedUserId, setAssignedUserId] = useState(
    () => eventDevice?.assigned_user_id || "",
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
        assigned_user_id: assignedUserId || null,
        clear_user: assignedUserId === "",
      });
      onSuccess();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Erro ao mover equipamento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Mover Ponto / Alterar Responsável</h3>
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
              placeholder="Ex: Sala de Controle, Docas..."
              value={locationPoint}
              onChange={(e) => setLocationPoint(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Responsável Operacional</label>
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
            >
              <option value="">Nenhum responsável atribuído</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <p
            style={{
              color: "#94a3b8",
              fontSize: "0.85rem",
              marginTop: "0.5rem",
            }}
          >
            * Esta ação encerra a associação anterior e registra a nova,
            garantindo histórico de auditoria.
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

function ConfirmUnassignModal({
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

function SwapDeviceModal({
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
    (d) => d.id !== currentDevice.device_id,
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
        assigned_user_id: currentDevice.assigned_user_id,
      });
      onSuccess();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail || "Erro ao realizar substituição no ponto.",
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
                  {d.asset_number} — {d.device_type ?? "Equipamento"} (
                  {d.model ?? d.hostname ?? "S/N"})
                </option>
              ))}
            </select>
          </div>

          <p style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            * O aparelho antigo será desvinculado e o substituto assumirá o mesmo
            posto mantendo a auditoria.
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

// ----------------------------------------------------------------------------
// SEÇÃO DE EVENTOS
// ----------------------------------------------------------------------------
function EventsView({ allDevices, users }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDevices, setEventDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Modais de Evento
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [movingDevice, setMovingDevice] = useState(null);
  const [unassigningDevice, setUnassigningDevice] = useState(null);
  const [swappingDevice, setSwappingDevice] = useState(null);

  function refreshEvents() {
    getEvents()
      .then((data) => setEvents(data))
      .catch((err) => console.error("Erro ao atualizar eventos:", err));
  }

  function refreshSelectedEventDevices(eventId) {
    getEventDevices(eventId, true)
      .then((activeDevices) => setEventDevices(activeDevices))
      .catch((err) => console.error("Erro ao atualizar equipamentos:", err));
  }

  useEffect(() => {
    let ignore = false;
    getEvents()
      .then((data) => {
        if (!ignore) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar eventos:", err);
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;

    let ignore = false;
    getEventDevices(selectedEvent.id, true)
      .then((activeDevices) => {
        if (!ignore) {
          setEventDevices(activeDevices);
          setLoadingDevices(false);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar equipamentos do evento:", err);
        if (!ignore) setLoadingDevices(false);
      });
    return () => {
      ignore = true;
    };
  }, [selectedEvent]);

  function handleSelectEvent(evt) {
    setLoadingDevices(true);
    setSelectedEvent(evt);
  }

  const deviceMap = useMemo(() => {
    const map = new Map();
    for (const d of allDevices) {
      map.set(d.id, d);
    }
    return map;
  }, [allDevices]);

  const userMap = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      map.set(u.id, u.name);
    }
    return map;
  }, [users]);

  // ✅ FILTRO DE AUDITORIA: Exibe nos cards APENAS equipamentos ativos no momento
  const groupedByPoint = useMemo(() => {
    const groups = {};
    for (const ed of eventDevices) {
      if (ed.unassigned_at || ed.is_active === false) {
        continue;
      }
      const point = ed.location_point || "Ponto Não Definido";
      if (!groups[point]) groups[point] = [];
      groups[point].push(ed);
    }
    return groups;
  }, [eventDevices]);

  const availableDevices = useMemo(() => {
    const activeIds = new Set(
      eventDevices
        .filter((ed) => !ed.unassigned_at && ed.is_active !== false)
        .map((ed) => ed.device_id),
    );
    return allDevices.filter((d) => !activeIds.has(d.id));
  }, [allDevices, eventDevices]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <p>Carregando eventos...</p>
      </div>
    );
  }

  // --- Visão Detalhada do Evento ---
  if (selectedEvent) {
    return (
      <div className="event-detail-container">
        <div className="section-header" style={{ marginBottom: "1.5rem" }}>
          <div>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginBottom: "0.5rem" }}
              onClick={() => setSelectedEvent(null)}
            >
              ← Voltar aos Eventos
            </button>
            <h2>{selectedEvent.name}</h2>
            <span style={{ color: "#94a3b8" }}>
              📍 {selectedEvent.location} | Período:{" "}
              {formatBrasiliaDateTime(selectedEvent.starts_at)} até{" "}
              {formatBrasiliaDateTime(selectedEvent.ends_at)}
            </span>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="btn-create-device"
              onClick={() => setIsAddDeviceOpen(true)}
            >
              + Vincular Equipamento
            </button>
          </div>
        </div>

        {loadingDevices ? (
          <p>Carregando postos e equipamentos...</p>
        ) : Object.keys(groupedByPoint).length === 0 ? (
          <div
            className="empty-state"
            style={{
              padding: "3rem",
              textAlign: "center",
              background: "#1e293b",
              borderRadius: "8px",
            }}
          >
            <p>Nenhum equipamento associado a este evento no momento.</p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: "1rem" }}
              onClick={() => setIsAddDeviceOpen(true)}
            >
              + Adicionar primeiro equipamento
            </button>
          </div>
        ) : (
          Object.entries(groupedByPoint).map(([pointName, list]) => (
            <div
              key={pointName}
              className="point-card"
              style={{
                marginBottom: "2rem",
                background: "#1e293b",
                padding: "1.25rem",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #334155",
                  paddingBottom: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    color: "#38bdf8",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span>📍</span> {pointName}
                </h3>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                  {list.length}{" "}
                  {list.length === 1 ? "equipamento" : "equipamentos"}
                </span>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Patrimônio</th>
                      <th>Tipo</th>
                      <th>Responsável</th>
                      <th>Status de Comunicação</th>
                      <th>Último Contato</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((ed) => {
                      const dev = deviceMap.get(ed.device_id);
                      const respName = ed.assigned_user_id
                        ? userMap.get(ed.assigned_user_id) || "Atribuído"
                        : "-";
                      return (
                        <tr key={ed.id}>
                          <td className="asset-number">
                            {dev?.asset_number ?? "N/A"}
                          </td>
                          <td>{dev?.device_type ?? "-"}</td>
                          <td>{respName}</td>
                          <td>
                            <StatusBadge
                              status={dev?.status ?? STATUS.OFFLINE}
                            />
                          </td>
                          <td>{formatBrasiliaDateTime(dev?.last_seen)}</td>
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="btn-action-edit"
                              onClick={() => setMovingDevice(ed)}
                              title="Alterar ponto ou responsável"
                            >
                              Mover
                            </button>
                            {/* Botão de Substituição Operacional */}
                            <button
                              type="button"
                              className="btn-action-edit"
                              style={{
                                background: "#b45309",
                                borderColor: "#d97706",
                              }}
                              onClick={() => setSwappingDevice(ed)}
                              title="Trocar por outro aparelho neste ponto"
                            >
                              Substituir
                            </button>
                            <button
                              type="button"
                              className="btn-action-delete"
                              onClick={() => setUnassigningDevice(ed)}
                              title="Desvincular do evento"
                            >
                              Desvincular
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        <AddDeviceToEventModal
          event={selectedEvent}
          devices={availableDevices}
          users={users}
          isOpen={isAddDeviceOpen}
          onClose={() => setIsAddDeviceOpen(false)}
          onSuccess={() => {
            setIsAddDeviceOpen(false);
            refreshSelectedEventDevices(selectedEvent.id);
          }}
        />

        {movingDevice && (
          <MoveDeviceModal
            eventId={selectedEvent.id}
            eventDevice={movingDevice}
            users={users}
            isOpen={Boolean(movingDevice)}
            onClose={() => setMovingDevice(null)}
            onSuccess={() => {
              setMovingDevice(null);
              refreshSelectedEventDevices(selectedEvent.id);
            }}
          />
        )}

        {unassigningDevice && (
          <ConfirmUnassignModal
            eventId={selectedEvent.id}
            eventDevice={unassigningDevice}
            isOpen={Boolean(unassigningDevice)}
            onClose={() => setUnassigningDevice(null)}
            onSuccess={() => {
              setUnassigningDevice(null);
              refreshSelectedEventDevices(selectedEvent.id);
            }}
          />
        )}

        {swappingDevice && (
          <SwapDeviceModal
            eventId={selectedEvent.id}
            currentDevice={swappingDevice}
            devices={allDevices}
            isOpen={Boolean(swappingDevice)}
            onClose={() => setSwappingDevice(null)}
            onSuccess={() => {
              setSwappingDevice(null);
              refreshSelectedEventDevices(selectedEvent.id);
            }}
          />
        )}
      </div>
    );
  }

  // --- Lista Geral de Eventos ---
  return (
    <div className="events-list-section">
      <div className="section-header">
        <div>
          <h2>Eventos Cadastrados</h2>
          <span>{events.length} eventos registrados na operação</span>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-create-device"
            onClick={() => setIsCreateOpen(true)}
          >
            + Novo Evento
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.25rem",
          marginTop: "1.5rem",
        }}
      >
        {events.map((evt) => (
          <div
            key={evt.id}
            style={{
              background: "#1e293b",
              padding: "1.5rem",
              borderRadius: "8px",
              border: evt.is_active
                ? "1px solid #38bdf8"
                : "1px solid #334155",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "0.75rem",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.15rem",
                    color: "#f8fafc",
                  }}
                >
                  {evt.name}
                </h3>
                <span
                  className={`status-badge ${evt.is_active ? "status-online" : "status-offline"}`}
                >
                  {evt.is_active ? "Ativo" : "Encerrado"}
                </span>
              </div>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                  margin: "0.25rem 0",
                }}
              >
                📍 {evt.location}
              </p>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  margin: "0.25rem 0",
                }}
              >
                {formatBrasiliaDateTime(evt.starts_at)} —{" "}
                {formatBrasiliaDateTime(evt.ends_at)}
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              style={{
                marginTop: "1.25rem",
                width: "100%",
                textAlign: "center",
              }}
              onClick={() => handleSelectEvent(evt)}
            >
              Ver Equipamentos e Postos →
            </button>
          </div>
        ))}

        {events.length === 0 && (
          <div
            className="empty-state"
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "3rem",
            }}
          >
            Nenhum evento cadastrado. Clique no botão acima para criar o
            primeiro.
          </div>
        )}
      </div>

      <CreateEventModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          refreshEvents();
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// DASHBOARD PRINCIPAL
// ----------------------------------------------------------------------------
function Dashboard({ onLogout }) {
  const { devices, loading, refreshing, error, lastUpdated, refresh } =
    useDevices();

  const [activeTab, setActiveTab] = useState("devices");
  const [users, setUsers] = useState([]);

  // Filtros de Equipamentos
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [requestedPage, setRequestedPage] = useState(1);

  // Modais de Equipamentos
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdDeviceData, setCreatedDeviceData] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deletingDevice, setDeletingDevice] = useState(null);

  // --------------------------------------------------------------------------
  // CENTRAL DE ALERTAS RESILIENTE (WEBSOCKET + ESTADO REAL DOS EQUIPAMENTOS)
  // --------------------------------------------------------------------------
  const [dismissedAlerts, setDismissedAlerts] = useState(() => new Set());
  const [wsAlerts, setWsAlerts] = useState([]);

  // Alerta automático: qualquer aparelho com bateria <= 10% ativa o banner
  const criticalBatteryAlerts = useMemo(() => {
    return devices
      .filter(
        (d) =>
          typeof d.battery_level === "number" &&
          d.battery_level <= 10 &&
          !dismissedAlerts.has(d.id),
      )
      .map((d) => ({
        device_id: d.id,
        asset_number: d.asset_number,
        battery_level: d.battery_level,
        reason: "BATTERY_CRITICAL",
        location_point: "Posto Operacional",
      }));
  }, [devices, dismissedAlerts]);

  // Combina e remove alertas duplicados para o mesmo aparelho
  const activeAlerts = useMemo(() => {
    const combined = [...criticalBatteryAlerts, ...wsAlerts];
    const seen = new Set();
    return combined.filter((a) => {
      if (seen.has(a.device_id) || dismissedAlerts.has(a.device_id)) {
        return false;
      }
      seen.add(a.device_id);
      return true;
    });
  }, [criticalBatteryAlerts, wsAlerts, dismissedAlerts]);

  useEffect(() => {
    function handleWebSocketAlert(e) {
      const data = e.detail;
      if (data && data.type === "ALERT_TRIGGERED") {
        setWsAlerts((prev) => [
          data,
          ...prev.filter((a) => a.device_id !== data.device_id),
        ]);
      }
    }

    window.addEventListener(
      "equipment-monitor:ws-message",
      handleWebSocketAlert,
    );
    return () => {
      window.removeEventListener(
        "equipment-monitor:ws-message",
        handleWebSocketAlert,
      );
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    getUsers()
      .then((data) => {
        if (!ignore) setUsers(data);
      })
      .catch((err) => {
        console.error("Erro ao listar responsáveis:", err);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const counts = useMemo(() => {
    const result = {};
    for (const device of devices) {
      result[device.status] = (result[device.status] ?? 0) + 1;
    }
    return result;
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return devices.filter((device) => {
      const matchesSearch =
        normalizedSearch === "" ||
        [
          device.asset_number,
          device.device_type,
          device.hostname,
          device.reported_ip,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(normalizedSearch),
        );
      const matchesStatus =
        statusFilter === "TODOS" || device.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [devices, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDevices.length / ITEMS_PER_PAGE),
  );
  const currentPage = Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDevices = filteredDevices.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );
  const firstVisibleDevice =
    filteredDevices.length === 0 ? 0 : startIndex + 1;
  const lastVisibleDevice = Math.min(
    startIndex + ITEMS_PER_PAGE,
    filteredDevices.length,
  );

  if (loading) {
    return (
      <main className="dashboard-loading" aria-live="polite">
        <p>Carregando equipamentos...</p>
      </main>
    );
  }

  return (
    <main>
      {/* Banner de Alerta Crítico */}
      <AlertBanner
        alerts={activeAlerts}
        onDismiss={(deviceId) => {
          setDismissedAlerts((prev) => new Set([...prev, deviceId]));
          setWsAlerts((prev) => prev.filter((a) => a.device_id !== deviceId));
        }}
        onAction={(alert) => {
          setActiveTab("events");
          setDismissedAlerts((prev) => new Set([...prev, alert.device_id]));
        }}
      />

      <header className="dashboard-header">
        <div className="brand">
          <img src="/asaph.png" alt="Logo ASAPH" className="brand-logo" />
        </div>

        <nav
          style={{ display: "flex", gap: "0.75rem" }}
          aria-label="Navegação Principal"
        >
          <button
            type="button"
            className={
              activeTab === "devices" ? "btn-primary" : "btn-secondary"
            }
            onClick={() => setActiveTab("devices")}
          >
            Equipamentos
          </button>
          <button
            type="button"
            className={
              activeTab === "events" ? "btn-primary" : "btn-secondary"
            }
            onClick={() => setActiveTab("events")}
          >
            Eventos & Postos
          </button>
        </nav>

        <div className="device-total">
          <button type="button" className="logout-button" onClick={onLogout}>
            Sair
          </button>
          <span>Equipamentos monitorados</span>
          <strong>{devices.length}</strong>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={refresh} disabled={refreshing}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Cards de Status Globais */}
      <section className="status-grid" aria-label="Resumo dos status">
        {SUMMARY_CARDS.map((card) => (
          <StatusCard
            key={card.status}
            title={card.title}
            count={counts[card.status] ?? 0}
            className={card.className}
          />
        ))}
      </section>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === "devices" ? (
        <section className="devices-section">
          <div className="section-header">
            <div>
              <h2>Inventário de Equipamentos</h2>
              <span>
                {filteredDevices.length === devices.length
                  ? `${devices.length} equipamentos cadastrados`
                  : `${filteredDevices.length} de ${devices.length} equipamentos encontrados`}
              </span>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="btn-create-device"
                onClick={() => setIsCreateOpen(true)}
              >
                + Cadastrar equipamento
              </button>

              <div className="refresh-info">
                <span>
                  Atualizado:{" "}
                  {lastUpdated
                    ? formatBrasiliaDateTime(lastUpdated)
                    : "Aguardando atualização"}
                </span>
                <button
                  type="button"
                  className="refresh-button"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  {refreshing ? "Atualizando..." : "Atualizar"}
                </button>
              </div>
            </div>
          </div>

          <div className="filters">
            <input
              type="search"
              aria-label="Buscar equipamentos"
              placeholder="Buscar patrimônio, tipo, hostname ou IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setRequestedPage(1);
              }}
            />

            <div className="status-filters" aria-label="Filtrar por status">
              {STATUS_FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.value}
                  className={statusFilter === filter.value ? "active" : ""}
                  aria-pressed={statusFilter === filter.value}
                  onClick={() => {
                    setStatusFilter(filter.value);
                    setRequestedPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Patrimônio</th>
                  <th>Tipo</th>
                  <th>Hostname</th>
                  <th>IP</th>
                  <th>Bateria</th>
                  <th>Status</th>
                  <th>Último contato</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.map((device) => (
                  <tr key={device.id}>
                    <td className="asset-number">
                      {device.asset_number ?? "-"}
                    </td>
                    <td>{device.device_type ?? "-"}</td>
                    <td>{device.hostname ?? "-"}</td>
                    <td>{device.reported_ip ?? "-"}</td>
                    <td>
                      {typeof device.battery_level === "number"
                        ? `${device.battery_level}%`
                        : "-"}
                    </td>
                    <td>
                      <StatusBadge status={device.status} />
                    </td>
                    <td>{formatBrasiliaDateTime(device.last_seen)}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn-action-edit"
                        onClick={() => setEditingDevice(device)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-action-delete"
                        onClick={() => setDeletingDevice(device)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedDevices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      Nenhum equipamento corresponde aos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredDevices.length > 0 && (
            <div className="pagination-footer">
              <span className="pagination-count">
                Exibindo {firstVisibleDevice}–{lastVisibleDevice} de{" "}
                {filteredDevices.length} equipamentos
              </span>
              <nav className="pagination" aria-label="Paginação">
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() => setRequestedPage((p) => p - 1)}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <span className="pagination-info">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() => setRequestedPage((p) => p + 1)}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </button>
              </nav>
            </div>
          )}
        </section>
      ) : (
        <EventsView allDevices={devices} users={users} />
      )}

      {/* Modais de Equipamentos */}
      <CreateDeviceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(data) => {
          setIsCreateOpen(false);
          setCreatedDeviceData(data);
        }}
      />

      <CredentialsDisplayModal
        deviceData={createdDeviceData}
        onClose={() => {
          setCreatedDeviceData(null);
          refresh();
        }}
      />

      {editingDevice && (
        <EditDeviceModal
          key={editingDevice.id}
          device={editingDevice}
          isOpen={Boolean(editingDevice)}
          onClose={() => setEditingDevice(null)}
          onSuccess={() => {
            setEditingDevice(null);
            refresh();
          }}
        />
      )}

      {deletingDevice && (
        <ConfirmDeleteModal
          device={deletingDevice}
          isOpen={Boolean(deletingDevice)}
          onClose={() => setDeletingDevice(null)}
          onSuccess={() => {
            setDeletingDevice(null);
            refresh();
          }}
        />
      )}

      <footer className="dashboard-footer">
        <span>ASAPH | Grupo Pleno</span>
        <span>Monitoramento de ativos</span>
      </footer>
    </main>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(() =>
    Boolean(getAccessToken()),
  );

  useEffect(() => {
    function handleSessionExpired() {
      clearAccessToken();
      setAuthenticated(false);
    }
    window.addEventListener(
      "equipment-monitor:session-expired",
      handleSessionExpired,
    );
    return () => {
      window.removeEventListener(
        "equipment-monitor:session-expired",
        handleSessionExpired,
      );
    };
  }, []);

  if (!authenticated) {
    return <Login onLoginSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <Dashboard
      onLogout={() => {
        clearAccessToken();
        setAuthenticated(false);
      }}
    />
  );
}

export default App;