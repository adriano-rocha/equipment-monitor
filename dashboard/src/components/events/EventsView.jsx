import { useEffect, useMemo, useState } from "react";
import { formatBrasiliaDateTime, STATUS } from "../../utils/formatters";
import { StatusBadge } from "../common/StatusBadge";
import {
  addDeviceToEvent,
  createEvent,
  getEventDevices,
  getEvents,
  removeDeviceFromEvent,
  swapEventDevice,
  updateEventDevice,
} from "../../services/api";

// ----------------------------------------------------------------------------
// MODAIS DE EVENTOS E PONTOS
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
// SEÇÃO PRINCIPAL DE EVENTOS
// ----------------------------------------------------------------------------
export function EventsView({ allDevices, users }) {
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

export default EventsView;