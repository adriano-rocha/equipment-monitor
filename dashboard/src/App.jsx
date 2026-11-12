import { useEffect, useMemo, useState } from "react";
import { useDevices } from "./hooks/useDevices";
import Login from "./Login";
import {
  clearAccessToken,
  getAccessToken,
  getEvents,
  getEventDevices,
  getUsers,
} from "./services/api";

import { STATUS_FILTERS, formatBrasiliaDateTime } from "./utils/formatters";

import { StatusBadge } from "./components/common/StatusBadge";
import { AlertBanner } from "./components/alerts/AlertBanner";
import {
  ConfirmDeleteModal,
  CreateDeviceModal,
  CredentialsDisplayModal,
  EditDeviceModal,
} from "./components/devices/DeviceModals";
import { EventsView } from "./components/events/EventsView";

const ITEMS_PER_PAGE = 10;

function getFilterVariant(filter) {
  const text = `${filter.label} ${filter.value}`.toLowerCase();
  if (text.includes("online")) return "btn-filter-online";
  if (
    text.includes("comunicação") ||
    text.includes("comunicacao") ||
    text.includes("warning") ||
    text.includes("sem")
  ) {
    return "btn-filter-warning";
  }
  if (text.includes("offline")) return "btn-filter-offline";
  return "btn-filter-todos";
}

function Dashboard({ onLogout }) {
  const { devices, loading, refreshing, error, lastUpdated, refresh } =
    useDevices();

  const [activeTab, setActiveTab] = useState("devices");
  const [, setUsers] = useState([]);

  // Estado que guarda o evento e patrimônio alvo do clique no alerta
  const [eventFocus, setEventFocus] = useState(null);

  const [search, setSearch] = useState("");
  // 'TODOS', 'ONLINE', 'SEM COMUNICAÇÃO', 'OFFLINE', 'EM_ESTOQUE', 'EM_OPERACAO'
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [requestedPage, setRequestedPage] = useState(1);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdDeviceData, setCreatedDeviceData] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deletingDevice, setDeletingDevice] = useState(null);

  const [dismissedAlerts, setDismissedAlerts] = useState(() => new Set());
  const [wsAlerts, setWsAlerts] = useState([]);

  // Mapeamento de alocação de dispositivos: device_id -> { eventName, locationPoint }
  const [eventAllocations, setEventAllocations] = useState(new Map());

  // Carregamento tolerante e não-bloqueante das alocações em segundo plano
  useEffect(() => {
    let ignore = false;

    const timer = setTimeout(async () => {
      try {
        const eventsList = await getEvents();
        if (!eventsList || !Array.isArray(eventsList)) return;

        const activeEvents = eventsList.filter((e) => e.is_active !== false);
        const map = new Map();

        for (const ev of activeEvents) {
          try {
            const activeDevs = await getEventDevices(ev.id, true);
            if (Array.isArray(activeDevs)) {
              activeDevs.forEach((ed) => {
                if (!ed.unassigned_at && ed.is_active !== false) {
                  map.set(ed.device_id, {
                    eventId: ev.id, // 👈 NOVO: Guarda o ID do evento para poder navegar até ele
                    eventName: ev.name,
                    locationPoint: ed.location_point || "Posto Ativo",
                  });
                }
              });
            }
          } catch {
            // Continua mesmo se um evento falhar
          }
        }

        if (!ignore) {
          setEventAllocations(map);
        }
      } catch (err) {
        console.warn("Alocações carregadas em modo tolerante:", err);
      }
    }, 1200);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, []);

  // Alerta automático: bateria <= 15%
  // Alerta automático: bateria <= 15% enriquecido com a alocação real
  const criticalBatteryAlerts = useMemo(() => {
    return devices
      .filter(
        (d) =>
          typeof d.battery_level === "number" &&
          d.battery_level <= 15 &&
          !dismissedAlerts.has(d.id),
      )
      .map((d) => {
        const alloc = eventAllocations.get(d.id);
        return {
          device_id: d.id,
          deviceId: d.id,
          asset_number: d.asset_number,
          assetNumber: d.asset_number,
          battery_level: d.battery_level,
          reason: "BATTERY_CRITICAL",
          event_id: alloc?.eventId || null,
          eventId: alloc?.eventId || null,
          event_name: alloc?.eventName || null,
          eventName: alloc?.eventName || null,
          location_point: alloc ? `${alloc.locationPoint} (${alloc.eventName})` : "Em Estoque / Maleta",
          latitude: d.latitude || null,
          longitude: d.longitude || null,
        };
      });
  }, [devices, dismissedAlerts, eventAllocations]);

  // Remove alertas duplicados
  const activeAlerts = useMemo(() => {
    const combined = [...criticalBatteryAlerts, ...wsAlerts];
    const seen = new Set();
    return combined.filter((a) => {
      const key = a.device_id || a.asset_number;
      if (seen.has(key) || dismissedAlerts.has(a.device_id)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [criticalBatteryAlerts, wsAlerts, dismissedAlerts]);

  // Escuta alertas do WebSocket em tempo real
  useEffect(() => {
    function handleWebSocketAlert(e) {
      const data = e.detail;
      if (data && data.type === "ALERT_TRIGGERED") {
        setDismissedAlerts((prev) => {
          const updated = new Set(prev);
          updated.delete(data.device_id);
          return updated;
        });

        setWsAlerts((prev) => [
          { ...data, receivedAt: Date.now() },
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

  // Contadores dinâmicos incluindo Estoque e Operação
  const counts = useMemo(() => {
    const result = { TODOS: devices.length };
    let inStock = 0;
    let inOperation = 0;

    for (const device of devices) {
      result[device.status] = (result[device.status] ?? 0) + 1;
      if (eventAllocations.has(device.id)) {
        inOperation++;
      } else {
        inStock++;
      }
    }

    result.EM_ESTOQUE = inStock;
    result.EM_OPERACAO = inOperation;

    return result;
  }, [devices, eventAllocations]);

  // Filtro de Dispositivos (com suporte aos novos filtros de Estoque e Operação)
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

      const isAllocated = eventAllocations.has(device.id);

      let matchesStatus = true;
      if (statusFilter === "TODOS") {
        matchesStatus = true;
      } else if (statusFilter === "EM_ESTOQUE") {
        matchesStatus = !isAllocated;
      } else if (statusFilter === "EM_OPERACAO") {
        matchesStatus = isAllocated;
      } else {
        matchesStatus = device.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [devices, search, statusFilter, eventAllocations]);

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
  const firstVisibleDevice = filteredDevices.length === 0 ? 0 : startIndex + 1;
  const lastVisibleDevice = Math.min(
    startIndex + ITEMS_PER_PAGE,
    filteredDevices.length,
  );

  if (loading) {
    return (
      <main className="dashboard-loading" aria-live="polite">
        <p>Carregando dispositivos...</p>
      </main>
    );
  }

  return (
    <main>
      <AlertBanner
        alerts={activeAlerts}
        onDismiss={(deviceId) => {
          setDismissedAlerts((prev) => new Set([...prev, deviceId]));
          setWsAlerts((prev) => prev.filter((a) => a.device_id !== deviceId));
        }}
        onAction={(alert) => {
          const devId = alert.device_id || alert.deviceId;
          const asset = alert.asset_number || alert.assetNumber || alert.device_name || "";
          const alloc = devId ? eventAllocations.get(devId) : null;
          const targetDevice = devices.find((d) => d.id === devId || d.asset_number === asset);

          const targetEventId = alert.event_id || alert.eventId || alloc?.eventId || null;
          const targetEventName = alert.event_name || alert.eventName || alloc?.eventName || "";
          const targetLocationPoint = alert.location_point || alloc?.locationPoint || "Posto Ativo";

          // 1. Se estiver alocado em um evento, vai para Eventos e abre a câmera no pino do aparelho
          if (targetEventId) {
            setEventFocus({
              eventId: targetEventId,
              eventName: targetEventName,
              assetNumber: asset || "SIM-RASTREIO",
              deviceId: devId,
              latitude: alert.latitude || targetDevice?.latitude || null,
              longitude: alert.longitude || targetDevice?.longitude || null,
              speed_kmh: alert.speed_kmh || null,
              distance_m: alert.distance_m || null,
              message: alert.message || null,
              location_point: targetLocationPoint,
              timestamp: Date.now(),
            });
            setActiveTab("events");
          } else {
            // 2. Se estiver em estoque (livre na maleta), abre a aba de Dispositivos e filtra direto pelo patrimônio dele
            setActiveTab("devices");
            if (asset) {
              setSearch(asset);
              setStatusFilter("TODOS");
              setRequestedPage(1);
            }
          }

          setWsAlerts((prev) => prev.filter((a) => a.device_id !== devId));
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
            Dispositivos
          </button>
          <button
            type="button"
            className={activeTab === "events" ? "btn-primary" : "btn-secondary"}
            onClick={() => setActiveTab("events")}
          >
            Eventos / Postos
          </button>
        </nav>

        <div className="device-total">
          <button type="button" className="logout-button" onClick={onLogout}>
            Sair
          </button>
          <span>Dispositivos monitorados</span>
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

      {/* Conteúdo da Aba Ativa */}
      {activeTab === "devices" ? (
        <section className="devices-section">
          <div className="section-header">
            <div>
              <h2>Inventário de Dispositivos</h2>
              <span>
                {filteredDevices.length === devices.length
                  ? `${devices.length} dispositivos cadastrados`
                  : `${filteredDevices.length} de ${devices.length} dispositivos encontrados`}
              </span>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="btn-create-device"
                onClick={() => setIsCreateOpen(true)}
              >
                + Cadastrar dispositivo
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
              aria-label="Buscar dispositivos"
              placeholder="Buscar patrimônio, tipo, hostname ou IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setRequestedPage(1);
              }}
            />

            <div className="status-filters" aria-label="Filtrar por status">
              {STATUS_FILTERS.map((filter) => {
                const count = counts[filter.value] ?? 0;
                const variantClass = getFilterVariant(filter);
                return (
                  <button
                    type="button"
                    key={filter.value}
                    className={`${variantClass} ${statusFilter === filter.value ? "active" : ""}`}
                    aria-pressed={statusFilter === filter.value}
                    onClick={() => {
                      setStatusFilter(filter.value);
                      setRequestedPage(1);
                    }}
                  >
                    {filter.label} ({count})
                  </button>
                );
              })}

              {/* FEATURE 3: BOTÕES RÁPIDOS DE ESTOQUE E OPERAÇÃO */}
              <button
                type="button"
                className={`btn-filter-todos ${statusFilter === "EM_ESTOQUE" ? "active" : ""}`}
                style={{
                  border: statusFilter === "EM_ESTOQUE" ? "1px solid #10b981" : "1px solid #334155",
                  background: statusFilter === "EM_ESTOQUE" ? "rgba(16, 185, 129, 0.25)" : undefined,
                  color: statusFilter === "EM_ESTOQUE" ? "#10b981" : undefined,
                }}
                onClick={() => {
                  setStatusFilter("EM_ESTOQUE");
                  setRequestedPage(1);
                }}
                title="Mostrar apenas dispositivos livres na maleta/estoque"
              >
                 Em Estoque ({counts.EM_ESTOQUE ?? 0})
              </button>

              <button
                type="button"
                className={`btn-filter-todos ${statusFilter === "EM_OPERACAO" ? "active" : ""}`}
                style={{
                  border: statusFilter === "EM_OPERACAO" ? "1px solid #38bdf8" : "1px solid #334155",
                  background: statusFilter === "EM_OPERACAO" ? "rgba(56, 189, 248, 0.25)" : undefined,
                  color: statusFilter === "EM_OPERACAO" ? "#38bdf8" : undefined,
                }}
                onClick={() => {
                  setStatusFilter("EM_OPERACAO");
                  setRequestedPage(1);
                }}
                title="Mostrar apenas dispositivos alocados em postos de eventos"
              >
                 Em Operação ({counts.EM_OPERACAO ?? 0})
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Patrimônio</th>
                  <th>Tipo</th>
                  {/* FEATURE 2: CABEÇALHO DA NOVA COLUNA */}
                  <th>Alocação / Posto</th>
                  <th>Hostname</th>
                  <th>IP</th>
                  <th>Bateria</th>
                  <th>Status</th>
                  <th>Último contato</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.map((device) => {
                  const alloc = eventAllocations.get(device.id);

                  return (
                    <tr key={device.id}>
                      <td className="asset-number">
                        {device.asset_number ?? "-"}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {device.device_type ?? "-"}
                      </td>

                      {/* FEATURE 2: BADGE DE ALOCAÇÃO NA LINHA */}
                      <td>
                        {alloc ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: "rgba(56, 189, 248, 0.15)",
                              color: "#38bdf8",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              whiteSpace: "nowrap",
                            }}
                            title={`Evento: ${alloc.eventName} | Posto: ${alloc.locationPoint}`}
                          >
                            📍 {alloc.eventName} ({alloc.locationPoint})
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: "rgba(148, 163, 184, 0.12)",
                              color: "#94a3b8",
                              border: "1px solid #334155",
                              whiteSpace: "nowrap",
                            }}
                          >
                             Em Estoque
                          </span>
                        )}
                      </td>

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
                  );
                })}
                {paginatedDevices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      Nenhum dispositivo corresponde aos filtros.
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
                {filteredDevices.length} dispositivos
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
        <EventsView
          allDevices={devices}
          focusTarget={eventFocus}
          onClearFocus={() => setEventFocus(null)}
        />
      )}

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
        <span>Monitoramento de dispositivos</span>
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