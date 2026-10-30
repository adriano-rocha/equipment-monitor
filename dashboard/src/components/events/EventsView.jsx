import { useEffect, useMemo, useState } from "react";
import { formatBrasiliaDateTime, STATUS } from "../../utils/formatters";
import { StatusBadge } from "../common/StatusBadge";
import {
  addDeviceToEvent,
  createEvent,
  deleteEvent,
  getEventDevices,
  getEvents,
  removeDeviceFromEvent,
  swapEventDevice,
  updateEventDevice,
} from "../../services/api";


function CreateEventModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    const trimmedName = name.trim();
    const trimmedLocation = location.trim();

    if (!trimmedName || !trimmedLocation) {
      setErrorMsg("Preencha o Nome do Evento e o Local.");
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      await createEvent({
        name: trimmedName,
        location: trimmedLocation,
        starts_at: now.toISOString(),
        ends_at: oneYearLater.toISOString(),
        is_active: true,
      });

      setName("");
      setLocation("");
      onSuccess();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Erro ao cadastrar evento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: "400px" }}>
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
              placeholder="Ex: AWS Summit, Convenção 2026..."
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
              placeholder="Ex: Expo SP, Pavilhão Azul, Anhembi..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions" style={{ marginTop: "1rem" }}>
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

function AddDeviceToEventModal({ event, devices, isOpen, onClose, onSuccess }) {
  const [deviceId, setDeviceId] = useState("");
  const [locationPoint, setLocationPoint] = useState("");
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
        assigned_user_id: null,
      });
      setDeviceId("");
      setLocationPoint("");
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
          <h3>Vincular Equipamento ao Posto</h3>
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
                  {d.device_type ?? "Equipamento"} — {d.asset_number}
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

function MoveDeviceModal({ eventId, eventDevice, isOpen, onClose, onSuccess }) {
  const [locationPoint, setLocationPoint] = useState(
    () => eventDevice?.location_point || "",
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
      setErrorMsg(err.response?.data?.detail || "Erro ao mover equipamento.");
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
              color: "#94a3b8",
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
        assigned_user_id: null,
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
                  {d.asset_number} — {d.device_type ?? "Equipamento"}
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

function ConfirmDeleteEventModal({ event, isOpen, onClose, onSuccess }) {
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
          associações de postos e equipamentos deste evento serão desfeitas.
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

export function EventsView({ allDevices }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDevices, setEventDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);

  // Busca rápida dentro do evento
  const [searchTerm, setSearchTerm] = useState("");

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
    setSearchTerm("");
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

  // Total de aparelhos ativos vinculados ao evento
  const activeEventDevicesCount = useMemo(() => {
    return eventDevices.filter(
      (ed) => !ed.unassigned_at && ed.is_active !== false,
    ).length;
  }, [eventDevices]);

  // Agrupa os equipamentos ativos por ponto físico aplicando o filtro de busca em tempo real
  const groupedByPoint = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const groups = {};

    for (const ed of eventDevices) {
      if (ed.unassigned_at || ed.is_active === false) {
        continue;
      }

      const point = ed.location_point || "Ponto Não Definido";
      const dev = deviceMap.get(ed.device_id);

      // Se houver busca digitada, filtra por patrimônio, ponto, tipo ou modelo
      if (term) {
        const matchesPoint = point.toLowerCase().includes(term);
        const matchesAsset = String(dev?.asset_number ?? "")
          .toLowerCase()
          .includes(term);
        const matchesType = String(dev?.device_type ?? "")
          .toLowerCase()
          .includes(term);
        const matchesModel = String(dev?.model ?? "")
          .toLowerCase()
          .includes(term);

        if (!matchesPoint && !matchesAsset && !matchesType && !matchesModel) {
          continue;
        }
      }

      if (!groups[point]) groups[point] = [];
      groups[point].push(ed);
    }
    return groups;
  }, [eventDevices, deviceMap, searchTerm]);

  // Total de aparelhos visíveis após o filtro
  const totalFilteredDevices = useMemo(() => {
    return Object.values(groupedByPoint).reduce(
      (acc, curr) => acc + curr.length,
      0,
    );
  }, [groupedByPoint]);

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
        <div className="section-header" style={{ marginBottom: "1.25rem" }}>
          <div>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginBottom: "0.5rem" }}
              onClick={() => {
                setSelectedEvent(null);
                setSearchTerm("");
              }}
            >
              ← Voltar aos Eventos
            </button>
            <h2>{selectedEvent.name}</h2>
            <span style={{ color: "#94a3b8" }}>
              📍 {selectedEvent.location}
            </span>
          </div>
          <div
            className="header-actions"
            style={{ display: "flex", gap: "0.5rem" }}
          >
            <button
              type="button"
              className="btn-action-delete"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              onClick={() => setDeletingEvent(selectedEvent)}
            >
              Excluir Evento
            </button>
            <button
              type="button"
              className="btn-create-device"
              onClick={() => setIsAddDeviceOpen(true)}
            >
              + Vincular Equipamento
            </button>
          </div>
        </div>
        
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              position: "relative",
              maxWidth: "520px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "0.85rem",
                color: "#64748b",
                fontSize: "0.95rem",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por patrimônio, tipo ou ponto (ex: 2098, Docas, Smartphone)..."
              style={{
                width: "100%",
                padding: "0.65rem 2.2rem 0.65rem 2.4rem",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{
                  position: "absolute",
                  right: "0.6rem",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "0.2rem 0.4rem",
                  fontSize: "0.85rem",
                }}
                title="Limpar pesquisa"
              >
                ✕
              </button>
            )}
          </div>

          {searchTerm && (
            <p
              style={{
                fontSize: "0.82rem",
                color: "#94a3b8",
                marginTop: "0.5rem",
                marginBottom: 0,
              }}
            >
              Mostrando {totalFilteredDevices} de {activeEventDevicesCount}{" "}
              aparelhos encontrados para "
              <strong style={{ color: "#38bdf8" }}>{searchTerm}</strong>".
            </p>
          )}
        </div>

        {loadingDevices ? (
          <p>Carregando postos e equipamentos...</p>
        ) : activeEventDevicesCount === 0 ? (
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
        ) : Object.keys(groupedByPoint).length === 0 ? (
          <div
            className="empty-state"
            style={{
              padding: "2.5rem",
              textAlign: "center",
              background: "#1e293b",
              borderRadius: "8px",
              border: "1px dashed #334155",
            }}
          >
            <p style={{ color: "#e2e8f0", margin: 0, fontWeight: 500 }}>
              Nenhum posto ou equipamento encontrado para "{searchTerm}".
            </p>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: "1rem", fontSize: "0.85rem" }}
              onClick={() => setSearchTerm("")}
            >
              Limpar busca
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
                      <th>Status de Comunicação</th>
                      <th>Último Contato</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((ed) => {
                      const dev = deviceMap.get(ed.device_id);
                      return (
                        <tr key={ed.id}>
                          <td className="asset-number">
                            {dev?.asset_number ?? "Equipamento"}
                          </td>
                          <td>{dev?.device_type ?? "-"}</td>
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
                              title="Alterar ponto físico"
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
                              title="Substituir por outro aparelho neste ponto"
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

        <ConfirmDeleteEventModal
          event={deletingEvent}
          isOpen={Boolean(deletingEvent)}
          onClose={() => setDeletingEvent(null)}
          onSuccess={() => {
            setDeletingEvent(null);
            setSelectedEvent(null);
            refreshEvents();
          }}
        />
      </div>
    );
  }

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
              border: evt.is_active ? "1px solid #38bdf8" : "1px solid #334155",
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
                  fontSize: "0.95rem",
                  margin: "0.25rem 0",
                }}
              >
                📍 {evt.location}
              </p>
            </div>

            <div
              style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}
            >
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, textAlign: "center" }}
                onClick={() => handleSelectEvent(evt)}
              >
                Ver Equipamentos e Postos →
              </button>
              <button
                type="button"
                className="btn-action-delete"
                style={{ padding: "0 0.8rem" }}
                onClick={() => setDeletingEvent(evt)}
                title="Excluir este evento"
              >
                Excluir
              </button>
            </div>
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

      <ConfirmDeleteEventModal
        event={deletingEvent}
        isOpen={Boolean(deletingEvent)}
        onClose={() => setDeletingEvent(null)}
        onSuccess={() => {
          setDeletingEvent(null);
          setSelectedEvent(null);
          refreshEvents();
        }}
      />
    </div>
  );
}

export default EventsView;
