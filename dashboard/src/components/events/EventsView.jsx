import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatBrasiliaDateTime, STATUS } from "../../utils/formatters";
import { StatusBadge } from "../common/StatusBadge";
import { GeofenceMap } from "./GeofenceMap";
import { getAccessToken, getEventDevices, getEvents } from "../../services/api";
import ClosureReportModal from "../reports/ClosureReportModal";
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

  // 1. Prioridade Máxima: ID exato do evento
  if (target.eventId) {
    const foundById = eventsList.find(
      (e) => String(e.id) === String(target.eventId)
    );
    if (foundById) return foundById;
  }

  const targetName = String(target.eventName || "").trim().toLowerCase();
  const targetPoint = String(target.location_point || "").trim().toLowerCase();
  const targetMsg = String(target.message || "").trim().toLowerCase();

  // 2. Busca por nome com desempate por Posto / Localização
  if (targetName) {
    const sameNameEvents = eventsList.filter((e) => {
      const evName = String(e.name || "").trim().toLowerCase();
      return evName === targetName || evName.includes(targetName) || targetName.includes(evName);
    });

    if (sameNameEvents.length === 1) {
      return sameNameEvents[0];
    }

    if (sameNameEvents.length > 1) {
      const cleanPoint = targetPoint.replace(/\([^)]*\)/g, "").trim();

      const foundByLocation = sameNameEvents.find((e) => {
        const evLoc = String(e.location || "").trim().toLowerCase();
        if (!evLoc) return false;
        return (
          (cleanPoint && (evLoc.includes(cleanPoint) || cleanPoint.includes(evLoc))) ||
          (targetPoint && (evLoc.includes(targetPoint) || targetPoint.includes(evLoc))) ||
          (targetMsg && targetMsg.includes(evLoc))
        );
      });

      if (foundByLocation) return foundByLocation;
      return sameNameEvents[0];
    }
  }

  // 3. Fallback: busca direta pela localização
  if (targetPoint) {
    const cleanPoint = targetPoint.replace(/\([^)]*\)/g, "").trim();
    const foundByLoc = eventsList.find((e) => {
      const evLoc = String(e.location || "").trim().toLowerCase();
      return evLoc && cleanPoint && (evLoc.includes(cleanPoint) || cleanPoint.includes(evLoc));
    });
    if (foundByLoc) return foundByLoc;
  }

  return null;
}

export function EventsView({ allDevices = [], focusTarget, onClearFocus }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isClosureReportOpen, setIsClosureReportOpen] = useState(false);
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
  const [eventSortConfig, setEventSortConfig] = useState({
    key: "asset_number",
    direction: "asc",
  });
  const [realtimeLocations, setRealtimeLocations] = useState({});

  const [searchTerm, setSearchTerm] = useState("");
  // 'all', 'online', 'warning', 'offline', 'alert', 'low_battery'
  const [statusFilter, setStatusFilter] = useState("all");
  const alertedRowRef = useRef(null);

  function handleEventSort(key) {
    setEventSortConfig((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: ["battery_level", "last_seen"].includes(key) ? "desc" : "asc",
      };
    });
  }

  function refreshEvents() {
    getEvents()
      .then((data) => setEvents(data))
      .catch((err) => console.error("Erro ao atualizar eventos:", err));
  }

  function refreshSelectedEventDevices(eventId) {
    getEventDevices(eventId, true)
      .then((activeDevices) => setEventDevices(activeDevices))
      .catch((err) => console.error("Erro ao atualizar dispositivo:", err));
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
        console.error("Erro ao carregar dispositivos do evento:", err);
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
        asset_number: dev?.asset_number || "Dispositivo",
        device_type: dev?.device_type || "Smartphone",
        location_point: ed.location_point,
        latitude: dev?.latitude,
        longitude: dev?.longitude,
        battery_level: dev?.battery_level,
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

  // Contadores dinâmicos de status incluindo Bateria Baixa/Crítica
  const statusCounts = useMemo(() => {
    let online = 0;
    let warning = 0;
    let offline = 0;
    let alertCount = 0;
    let lowBatteryCount = 0;

    for (const ed of eventDevices) {
      if (ed.unassigned_at || ed.is_active === false) continue;
      const dev = deviceMap.get(ed.device_id);
      const isAlerted = checkIsAlerted(ed, dev);
      if (isAlerted) alertCount++;

      const st = String(dev?.status || "").toLowerCase();
      if (st === "online") online++;
      else if (st === "offline") offline++;
      else warning++;

      if (typeof dev?.battery_level === "number" && dev.battery_level <= 20) {
        lowBatteryCount++;
      }
    }

    return {
      all: activeEventDevicesCount,
      online,
      warning,
      offline,
      alert: alertCount,
      lowBattery: lowBatteryCount,
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

      // Filtros de Status
      if (statusFilter === "online" && st !== "online") continue;
      if (statusFilter === "offline" && st !== "offline") continue;
      if (statusFilter === "warning" && (st === "online" || st === "offline")) continue;
      if (statusFilter === "alert" && !isAlerted) continue;
      if (
        statusFilter === "low_battery" &&
        !(typeof dev?.battery_level === "number" && dev.battery_level <= 20)
      ) {
        continue;
      }

      // Filtro por Texto de Busca
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

    for (const devices of Object.values(groups)) {
      devices.sort((first, second) => {
        const firstDevice = deviceMap.get(first.device_id);
        const secondDevice = deviceMap.get(second.device_id);
        let firstValue;
        let secondValue;

        if (eventSortConfig.key === "battery_level") {
          firstValue = firstDevice?.battery_level ?? -1;
          secondValue = secondDevice?.battery_level ?? -1;
          return eventSortConfig.direction === "asc"
            ? firstValue - secondValue
            : secondValue - firstValue;
        }

        if (eventSortConfig.key === "last_seen") {
          firstValue = firstDevice?.last_seen
            ? new Date(firstDevice.last_seen).getTime()
            : 0;
          secondValue = secondDevice?.last_seen
            ? new Date(secondDevice.last_seen).getTime()
            : 0;
          return eventSortConfig.direction === "asc"
            ? firstValue - secondValue
            : secondValue - firstValue;
        }

        firstValue =
          eventSortConfig.key === "status"
            ? firstDevice?.status ?? STATUS.ONLINE
            : firstDevice?.[eventSortConfig.key];
        secondValue =
          eventSortConfig.key === "status"
            ? secondDevice?.status ?? STATUS.ONLINE
            : secondDevice?.[eventSortConfig.key];
        const comparison = String(firstValue ?? "")
          .toLowerCase()
          .localeCompare(String(secondValue ?? "").toLowerCase(), undefined, {
            numeric: true,
          });
        return eventSortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    return groups;
  }, [
    eventDevices,
    deviceMap,
    searchTerm,
    statusFilter,
    checkIsAlerted,
    eventSortConfig,
  ]);

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
        <div className="section-header event-detail-header">
          <div>
            <button
              type="button"
              className="btn-ghost event-back-button"
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
              className="event-location-details"
            >
              <span>{selectedEvent.location}</span>
              {selectedEvent.geofence_radius && (
                <span className="event-geofence-indicator">
                  Cerca: {selectedEvent.geofence_radius}m
                </span>
              )}
            </div>
          </div>

          <div className="header-actions event-detail-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsClosureReportOpen(true)}
            >
              Romaneio de Fechamento
            </button>
            <div className="event-view-switcher" role="group" aria-label="Modo de visualização">
              <button
                type="button"
                className={eventViewMode === "split" ? "active" : ""}
                aria-pressed={eventViewMode === "split"}
                onClick={() => setEventViewMode("split")}
              >
                Mapa/Lista
              </button>
              <button
                type="button"
                className={eventViewMode === "map" ? "active" : ""}
                aria-pressed={eventViewMode === "map"}
                onClick={() => setEventViewMode("map")}
              >
                Mapa
              </button>
              <button
                type="button"
                className={eventViewMode === "list" ? "active" : ""}
                aria-pressed={eventViewMode === "list"}
                onClick={() => setEventViewMode("list")}
              >
                Lista
              </button>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditingEvent(selectedEvent)}
              title="Editar nome, local, raio ou coordenadas da cerca"
            >
              Editar
            </button>

            <button
              type="button"
              className="btn-danger"
              onClick={() => setDeletingEvent(selectedEvent)}
            >
              Excluir
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsAddDeviceOpen(true)}
            >
              + Vincular Dispositivo
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
            <div className="event-devices-toolbar">
              <div className="event-search-filter-row">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar patrimônio, tipo ou posto..."
                  aria-label="Buscar dispositivos nos postos"
                  className="event-search-input"
                />
                <div className="event-status-filters" aria-label="Filtrar por status">
                  <button
                    type="button"
                    className={statusFilter === "all" ? "active" : ""}
                    aria-pressed={statusFilter === "all"}
                    onClick={() => setStatusFilter("all")}
                  >
                    Todos ({statusCounts.all})
                  </button>
                  <button
                    type="button"
                    className={statusFilter === "online" ? "active" : ""}
                    aria-pressed={statusFilter === "online"}
                    onClick={() => setStatusFilter("online")}
                  >
                    Online ({statusCounts.online})
                  </button>
                  <button
                    type="button"
                    className={statusFilter === "warning" ? "active" : ""}
                    aria-pressed={statusFilter === "warning"}
                    onClick={() => setStatusFilter("warning")}
                  >
                    Sem comunicação ({statusCounts.warning})
                  </button>
                  <button
                    type="button"
                    className={statusFilter === "offline" ? "active" : ""}
                    aria-pressed={statusFilter === "offline"}
                    onClick={() => setStatusFilter("offline")}
                  >
                    Offline ({statusCounts.offline})
                  </button>
                  {statusCounts.lowBattery > 0 && (
                    <button
                      type="button"
                      className={statusFilter === "low_battery" ? "active" : ""}
                      aria-pressed={statusFilter === "low_battery"}
                      onClick={() => setStatusFilter("low_battery")}
                    >
                      Bateria baixa ({statusCounts.lowBattery})
                    </button>
                  )}
                  {statusCounts.alert > 0 && (
                    <button
                      type="button"
                      className={statusFilter === "alert" ? "active" : ""}
                      aria-pressed={statusFilter === "alert"}
                      onClick={() => setStatusFilter("alert")}
                    >
                      Em alerta ({statusCounts.alert})
                    </button>
                  )}
                </div>
              </div>
              {(searchTerm || statusFilter !== "all") && (
                <div className="event-filter-summary">
                  <span>
                    Mostrando {totalFilteredDevices} de {activeEventDevicesCount} dispositivos
                    {searchTerm && ` para "${searchTerm}"`}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      if (onClearFocus) onClearFocus();
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>

            {loadingDevices ? (
              <p>Carregando postos e dispositivos...</p>
            ) : activeEventDevicesCount === 0 ? (
              <div className="empty-state event-empty-state">
                <p>Nenhum dispositivo associado a este evento no momento.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setIsAddDeviceOpen(true)}
                >
                  + Adicionar primeiro dispositivo
                </button>
              </div>
            ) : Object.keys(groupedByPoint).length === 0 ? (
              <div className="empty-state event-empty-state">
                <p>
                  Nenhum posto ou dispositivo encontrado com os filtros atuais.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
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
                <div key={pointName} className="point-card">
                  <div className="point-card-header">
                    <h3>{pointName}</h3>
                    <span>
                      {list.length}{" "}
                      {list.length === 1 ? "dispositivo" : "dispositivos"}
                    </span>
                  </div>

                  <div className="table-container">
                    <table className="event-devices-table">
                      <thead>
                        <tr>
                          {[
                            { label: "Patrimônio", key: "asset_number" },
                            { label: "Tipo", key: "device_type" },
                            { label: "Bateria", key: "battery_level" },
                            { label: "Status de Comunicação", key: "status" },
                            { label: "Último Contato", key: "last_seen" },
                          ].map((column) => {
                            const isSorted =
                              eventSortConfig.key === column.key;
                            return (
                              <th
                                key={column.key}
                                aria-sort={
                                  isSorted
                                    ? eventSortConfig.direction === "asc"
                                      ? "ascending"
                                      : "descending"
                                    : "none"
                                }
                              >
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => handleEventSort(column.key)}
                                  title={`Ordenar por ${column.label}`}
                                >
                                  <span>{column.label}</span>
                                  <span
                                    className={
                                      isSorted
                                        ? "sort-indicator is-active"
                                        : "sort-indicator"
                                    }
                                    aria-hidden="true"
                                  >
                                    {isSorted
                                      ? eventSortConfig.direction === "asc"
                                        ? "▲"
                                        : "▼"
                                      : "⇅"}
                                  </span>
                                </button>
                              </th>
                            );
                          })}
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
                              className={isAlerted ? "is-alerted" : ""}
                            >
                              <td className="asset-number">
                                <span>
                                  {dev?.asset_number ?? "SIM-RASTREIO"}
                                  {isAlerted && (
                                    <span className="device-alert-tag">
                                      Alvo do alerta
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="device-type-cell">
                                {dev?.device_type ?? "Smartphone"}
                              </td>
                              <td>
                                {typeof dev?.battery_level === "number" ? (
                                  <span
                                    className={`battery-value ${
                                      dev.battery_level <= 15
                                        ? "is-critical"
                                        : dev.battery_level <= 30
                                          ? "is-low"
                                          : ""
                                    }`}
                                  >
                                    {dev.battery_level}%
                                  </span>
                                ) : (
                                  "-"
                                )}
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
                                  className="btn-secondary"
                                  onClick={() => setMovingDevice(ed)}
                                  title="Alterar ponto físico"
                                >
                                  Mover
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => setSwappingDevice(ed)}
                                  title="Substituir por outro aparelho neste ponto"
                                >
                                  Substituir
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost-danger"
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

        {isClosureReportOpen && (
          <ClosureReportModal
            isOpen={isClosureReportOpen}
            onClose={() => setIsClosureReportOpen(false)}
            eventId={selectedEvent.id}
            eventName={selectedEvent.name}
            apiBaseUrl={(
              import.meta.env.VITE_API_URL ||
              import.meta.env.VITE_API_BASE_URL ||
              "http://localhost:8000/api/v1"
            )
              .replace(/\/api\/v1\/?$/, "")
              .replace(/\/+$/, "")}
            token={getAccessToken()}
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
            className="btn-primary"
            onClick={() => setIsCreateOpen(true)}
          >
            + Novo Evento
          </button>
        </div>
      </div>

      <div className="events-grid">
        {events.map((evt) => (
          <article key={evt.id} className="event-card">
            <div>
              <div className="event-card-heading">
                <h3>{evt.name}</h3>
                <span
                  className={`status-badge ${
                    evt.is_active ? "status-online" : "status-offline"
                  }`}
                >
                  {evt.is_active ? "Ativo" : "Encerrado"}
                </span>
              </div>
              <p className="event-card-location">{evt.location}</p>
              {evt.geofence_radius && (
                <span className="event-card-geofence">
                  Cerca: {evt.geofence_radius}m
                </span>
              )}
            </div>

            <div className="event-card-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleSelectEvent(evt)}
              >
                Abrir evento
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditingEvent(evt)}
                title="Editar este evento"
              >
                Editar
              </button>

              <button
                type="button"
                className="btn-danger"
                onClick={() => setDeletingEvent(evt)}
                title="Excluir este evento"
              >
                Excluir
              </button>
            </div>
          </article>
        ))}

        {events.length === 0 && (
          <div className="empty-state event-empty-list">
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