import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatBrasiliaDateTime, STATUS } from "../../utils/formatters";
import { StatusBadge } from "../common/StatusBadge";
import { GeofenceMap } from "./GeofenceMap";
import { getEventDevices, getEvents } from "../../services/api";
import {
  AddDeviceToEventModal,
  ConfirmDeleteEventModal,
  ConfirmUnassignModal,
  CreateEventModal,
  EditEventModal,
  MoveDeviceModal,
  SwapDeviceModal,
} from "./modals";

function findTargetEvent(eventsList, target) {
  if (!target || !eventsList || eventsList.length === 0) return null;

  return eventsList.find((e) => {
    if (target.eventId && String(e.id) === String(target.eventId)) {
      return true;
    }
    if (target.eventName) {
      const evName = String(e.name || "").trim().toLowerCase();
      const targetName = String(target.eventName).trim().toLowerCase();
      return (
        evName === targetName ||
        evName.includes(targetName) ||
        targetName.includes(evName)
      );
    }
    return false;
  });
}

export function EventsView({ allDevices = [], focusTarget, onClearFocus }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDevices, setEventDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Estados dos Modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [movingDevice, setMovingDevice] = useState(null);
  const [unassigningDevice, setUnassigningDevice] = useState(null);
  const [swappingDevice, setSwappingDevice] = useState(null);

  const [eventViewMode, setEventViewMode] = useState("split");
  const [realtimeLocations, setRealtimeLocations] = useState({});

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const alertedRowRef = useRef(null);

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

          if (focusTarget) {
            const target = findTargetEvent(data, focusTarget);
            if (target) {
              setSelectedEvent(target);
              setSearchTerm("");
            }
          }
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar eventos:", err);
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusTarget || events.length === 0) return;

    const target = findTargetEvent(events, focusTarget);
    if (target) {
      const timer = setTimeout(() => {
        setSelectedEvent(target);
        setSearchTerm("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [focusTarget, events]);

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

  useEffect(() => {
    function handleRealtimeUpdate(e) {
      const data = e.detail;
      if (!data) return;

      if (data.message) {
        window.__lastAlertMessage = data.message;
      }

      let speed = data.speed_kmh;
      if (!speed && data.message) {
        const speedMatch = data.message.match(/([\d.]+)\s*km\/h/i);
        if (speedMatch) speed = speedMatch[1];
      }

      let distance = data.distance_m || data.distance;
      if (!distance && data.message) {
        const distMatch = data.message.match(/([\d.]+)\s*m/i);
        if (distMatch) distance = Math.round(parseFloat(distMatch[1]));
      }

      const lat = data.latitude;
      const lng = data.longitude;

      if (lat && lng) {
        setRealtimeLocations((prev) => ({
          ...prev,
          [data.device_id]: {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            speed: speed || "0.0",
            distance: distance || null,
            isAlert: data.type === "ALERT_TRIGGERED",
          },
        }));
      }
    }

    window.addEventListener("equipment-monitor:ws-message", handleRealtimeUpdate);
    return () => {
      window.removeEventListener("equipment-monitor:ws-message", handleRealtimeUpdate);
    };
  }, []);

  useEffect(() => {
    if (focusTarget && alertedRowRef.current) {
      const timer = setTimeout(() => {
        alertedRowRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [focusTarget, eventDevices, selectedEvent]);

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

  const enrichedEventDevices = useMemo(() => {
    return eventDevices.map((ed) => {
      const dev = deviceMap.get(ed.device_id);
      return {
        id: ed.device_id,
        device_id: ed.device_id,
        asset_number: dev?.asset_number || "Equipamento",
        device_type: dev?.device_type || "Smartphone",
        location_point: ed.location_point,
        latitude: dev?.latitude,
        longitude: dev?.longitude,
      };
    });
  }, [eventDevices, deviceMap]);

  const activeEventDevicesCount = useMemo(() => {
    return eventDevices.filter(
      (ed) => !ed.unassigned_at && ed.is_active !== false
    ).length;
  }, [eventDevices]);

  const checkIsAlerted = useCallback(
    (ed, dev) => {
      if (!focusTarget) return false;

      const targetDevId = focusTarget.deviceId
        ? String(focusTarget.deviceId).toLowerCase()
        : "";
      const targetAsset = focusTarget.assetNumber
        ? String(focusTarget.assetNumber).trim().toLowerCase()
        : "sim-rastreio";

      if (
        targetDevId &&
        (String(ed.device_id).toLowerCase() === targetDevId ||
          String(dev?.id).toLowerCase() === targetDevId)
      ) {
        return true;
      }

      const currentAsset = String(dev?.asset_number || ed.asset_number || "")
        .trim()
        .toLowerCase();
      if (
        targetAsset &&
        currentAsset &&
        (currentAsset === targetAsset ||
          currentAsset.includes(targetAsset) ||
          targetAsset.includes(currentAsset))
      ) {
        return true;
      }

      const currentHost = String(dev?.hostname || dev?.serial_number || "")
        .trim()
        .toLowerCase();
      if (targetAsset && currentHost && currentHost.includes(targetAsset)) {
        return true;
      }

      return false;
    },
    [focusTarget]
  );

  const statusCounts = useMemo(() => {
    let online = 0;
    let warning = 0;
    let offline = 0;
    let alertCount = 0;

    for (const ed of eventDevices) {
      if (ed.unassigned_at || ed.is_active === false) continue;
      const dev = deviceMap.get(ed.device_id);
      const isAlerted = checkIsAlerted(ed, dev);
      if (isAlerted) alertCount++;

      const st = String(dev?.status || "").toLowerCase();
      if (st === "online") online++;
      else if (st === "offline") offline++;
      else warning++;
    }

    return {
      all: activeEventDevicesCount,
      online,
      warning,
      offline,
      alert: alertCount,
    };
  }, [eventDevices, deviceMap, activeEventDevicesCount, checkIsAlerted]);

  const groupedByPoint = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const groups = {};

    for (const ed of eventDevices) {
      if (ed.unassigned_at || ed.is_active === false) {
        continue;
      }

      const point = ed.location_point || "Ponto Não Definido";
      const dev = deviceMap.get(ed.device_id);
      const isAlerted = checkIsAlerted(ed, dev);
      const st = String(dev?.status || "online").toLowerCase();

      if (statusFilter === "online" && st !== "online") continue;
      if (statusFilter === "offline" && st !== "offline") continue;
      if (statusFilter === "warning" && (st === "online" || st === "offline")) continue;
      if (statusFilter === "alert" && !isAlerted) continue;

      if (term) {
        const matchesPoint = point.toLowerCase().includes(term);
        const matchesAsset = String(dev?.asset_number ?? "").toLowerCase().includes(term);
        const matchesType = String(dev?.device_type ?? "").toLowerCase().includes(term);
        const matchesModel = String(dev?.model ?? "").toLowerCase().includes(term);

        if (!matchesPoint && !matchesAsset && !matchesType && !matchesModel) {
          continue;
        }
      }

      if (!groups[point]) groups[point] = [];
      groups[point].push(ed);
    }
    return groups;
  }, [eventDevices, deviceMap, searchTerm, statusFilter, checkIsAlerted]);

  const totalFilteredDevices = useMemo(() => {
    return Object.values(groupedByPoint).reduce(
      (acc, curr) => acc + curr.length,
      0
    );
  }, [groupedByPoint]);

  const availableDevices = useMemo(() => {
    const activeIds = new Set(
      eventDevices
        .filter((ed) => !ed.unassigned_at && ed.is_active !== false)
        .map((ed) => ed.device_id)
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
                setStatusFilter("all");
                if (onClearFocus) onClearFocus();
              }}
            >
              ← Voltar aos Eventos
            </button>
            <h2>{selectedEvent.name}</h2>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                marginTop: "0.25rem",
              }}
            >
              <span style={{ color: "#94a3b8" }}>
                📍 {selectedEvent.location}
              </span>
              {selectedEvent.geofence_radius && (
                <span
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  🛡️ Cerca: {selectedEvent.geofence_radius}m
                </span>
              )}
            </div>
          </div>

          <div
            className="header-actions"
            style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
          >
            <div
              style={{
                display: "flex",
                background: "#0f172a",
                padding: "3px",
                borderRadius: "6px",
                border: "1px solid #334155",
                marginRight: "0.5rem",
              }}
            >
              <button
                type="button"
                onClick={() => setEventViewMode("split")}
                style={{
                  background:
                    eventViewMode === "split"
                      ? "rgba(56, 189, 248, 0.2)"
                      : "transparent",
                  color: eventViewMode === "split" ? "#38bdf8" : "#94a3b8",
                  border: "none",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Mapa/Lista
              </button>
              <button
                type="button"
                onClick={() => setEventViewMode("map")}
                style={{
                  background:
                    eventViewMode === "map"
                      ? "rgba(56, 189, 248, 0.2)"
                      : "transparent",
                  color: eventViewMode === "map" ? "#38bdf8" : "#94a3b8",
                  border: "none",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Mapa
              </button>
              <button
                type="button"
                onClick={() => setEventViewMode("list")}
                style={{
                  background:
                    eventViewMode === "list"
                      ? "rgba(56, 189, 248, 0.2)"
                      : "transparent",
                  color: eventViewMode === "list" ? "#38bdf8" : "#94a3b8",
                  border: "none",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Lista
              </button>
            </div>

            <button
              type="button"
              className="btn-action-edit"
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.85rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
              onClick={() => setEditingEvent(selectedEvent)}
              title="Editar nome, local, raio ou coordenadas da cerca"
            >
              Editar
            </button>

            <button
              type="button"
              className="btn-action-delete"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              onClick={() => setDeletingEvent(selectedEvent)}
            >
              Excluir
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

        {(eventViewMode === "split" || eventViewMode === "map") && (
          <div style={{ marginBottom: "1.5rem" }}>
            <GeofenceMap
              event={selectedEvent}
              devices={enrichedEventDevices}
              focusTarget={focusTarget}
              realtimeLocations={realtimeLocations}
            />
          </div>
        )}

        {(eventViewMode === "split" || eventViewMode === "list") && (
          <>
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    flex: "1 1 300px",
                    maxWidth: "460px",
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
                    placeholder="Buscar patrimônio, tipo ou ponto..."
                    style={{
                      width: "100%",
                      padding: "0.6rem 2.2rem 0.6rem 2.4rem",
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
                      onClick={() => {
                        setSearchTerm("");
                        if (onClearFocus) onClearFocus();
                      }}
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

                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    style={{
                      padding: "0.45rem 0.85rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: statusFilter === "all" ? "1px solid #10b981" : "1px solid #334155",
                      background: statusFilter === "all" ? "#10b981" : "#0f172a",
                      color: statusFilter === "all" ? "#ffffff" : "#cbd5e1",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Todos ({statusCounts.all})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("online")}
                    style={{
                      padding: "0.45rem 0.85rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: statusFilter === "online" ? "1px solid #10b981" : "1px solid #334155",
                      background: statusFilter === "online" ? "rgba(16, 185, 129, 0.2)" : "#0f172a",
                      color: statusFilter === "online" ? "#10b981" : "#cbd5e1",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Online ({statusCounts.online})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("warning")}
                    style={{
                      padding: "0.45rem 0.85rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: statusFilter === "warning" ? "1px solid #f59e0b" : "1px solid #334155",
                      background: statusFilter === "warning" ? "rgba(245, 158, 11, 0.2)" : "#0f172a",
                      color: statusFilter === "warning" ? "#f59e0b" : "#cbd5e1",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Sem comunicação ({statusCounts.warning})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("offline")}
                    style={{
                      padding: "0.45rem 0.85rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: statusFilter === "offline" ? "1px solid #ef4444" : "1px solid #334155",
                      background: statusFilter === "offline" ? "rgba(239, 68, 68, 0.2)" : "#0f172a",
                      color: statusFilter === "offline" ? "#ef4444" : "#cbd5e1",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Offline ({statusCounts.offline})
                  </button>

                  {statusCounts.alert > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("alert")}
                      style={{
                        padding: "0.45rem 0.85rem",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: "1px solid #ef4444",
                        background: statusFilter === "alert" ? "#ef4444" : "rgba(239, 68, 68, 0.2)",
                        color: "#ffffff",
                        boxShadow: "0 0 10px rgba(239, 68, 68, 0.5)",
                      }}
                    >
                      🚨 Em Alerta ({statusCounts.alert})
                    </button>
                  )}
                </div>
              </div>

              {(searchTerm || statusFilter !== "all") && (
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.5rem" }}>
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: 0 }}>
                    Mostrando {totalFilteredDevices} de {activeEventDevicesCount} aparelhos
                    {statusFilter !== "all" && <span> com filtro de status ativo</span>}
                    {searchTerm && <span> para "<strong style={{ color: "#38bdf8" }}>{searchTerm}</strong>"</span>}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      if (onClearFocus) onClearFocus();
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#38bdf8",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Limpar todos os filtros
                  </button>
                </div>
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
                  Nenhum posto ou equipamento encontrado com os filtros atuais.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: "1rem", fontSize: "0.85rem" }}
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    if (onClearFocus) onClearFocus();
                  }}
                >
                  Limpar filtros
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
                          const isAlerted = checkIsAlerted(ed, dev);

                          return (
                            <tr
                              key={ed.id}
                              ref={isAlerted ? alertedRowRef : null}
                              style={
                                isAlerted
                                  ? {
                                      background: "rgba(220, 38, 38, 0.22)",
                                      boxShadow: "inset 4px 0 0 #ef4444",
                                      transition: "all 0.3s ease",
                                    }
                                  : undefined
                              }
                            >
                              <td className="asset-number">
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.6rem",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <strong
                                    style={{
                                      color: isAlerted ? "#fca5a5" : "inherit",
                                    }}
                                  >
                                    {dev?.asset_number ?? "SIM-RASTREIO"}
                                  </strong>
                                  {isAlerted && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        color: "#ffffff",
                                        background: "#dc2626",
                                        border: "1px solid #ef4444",
                                        borderRadius: "4px",
                                        padding: "0.2rem 0.5rem",
                                        boxShadow:
                                          "0 0 12px rgba(239, 68, 68, 0.7)",
                                        letterSpacing: "0.02em",
                                      }}
                                    >
                                      🚨 Alvo do Alerta
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td style={{ textTransform: "capitalize" }}>
                                {dev?.device_type ?? "Smartphone"}
                              </td>
                              <td>
                                <StatusBadge
                                  status={dev?.status ?? STATUS.ONLINE}
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
          </>
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

        {Boolean(editingEvent) && (
          <EditEventModal
            key={editingEvent.id}
            event={editingEvent}
            isOpen={Boolean(editingEvent)}
            onClose={() => setEditingEvent(null)}
            onSuccess={(updated) => {
              setEditingEvent(null);
              refreshEvents();
              if (updated) {
                setSelectedEvent(updated);
              }
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
                  className={`status-badge ${
                    evt.is_active ? "status-online" : "status-offline"
                  }`}
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
              {evt.geofence_radius && (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "0.5rem",
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "#10b981",
                    padding: "0.2rem 0.55rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Cerca: {evt.geofence_radius}m
                </span>
              )}
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
                className="btn-action-edit"
                style={{ padding: "0 0.85rem" }}
                onClick={() => setEditingEvent(evt)}
                title="Editar este evento"
              >
                ✏️
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

      {Boolean(editingEvent) && (
        <EditEventModal
          key={editingEvent.id}
          event={editingEvent}
          isOpen={Boolean(editingEvent)}
          onClose={() => setEditingEvent(null)}
          onSuccess={(updated) => {
            setEditingEvent(null);
            refreshEvents();
            if (
              updated &&
              selectedEvent &&
              String(selectedEvent.id) === String(updated.id)
            ) {
              setSelectedEvent(updated);
            }
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

export default EventsView;