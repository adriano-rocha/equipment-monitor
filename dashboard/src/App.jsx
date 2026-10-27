import { useEffect, useMemo, useState } from "react";
import { useDevices } from "./hooks/useDevices";
import Login from "./Login";
import { clearAccessToken, getAccessToken, getUsers } from "./services/api";

import {
  STATUS_FILTERS,
  SUMMARY_CARDS,
  formatBrasiliaDateTime,
} from "./utils/formatters";

import { StatusBadge } from "./components/common/StatusBadge";
import { StatusCard } from "./components/common/StatusCard";
import { AlertBanner } from "./components/alerts/AlertBanner";
import {
  ConfirmDeleteModal,
  CreateDeviceModal,
  CredentialsDisplayModal,
  EditDeviceModal,
} from "./components/devices/DeviceModals";
import { EventsView } from "./components/events/EventsView";

const ITEMS_PER_PAGE = 10;

// ----------------------------------------------------------------------------
// DASHBOARD OPERACIONAL
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
  // CENTRAL DE ALERTAS (WEBSOCKET + ESTADO REAL DOS EQUIPAMENTOS)
  // --------------------------------------------------------------------------
  const [dismissedAlerts, setDismissedAlerts] = useState(() => new Set());
  const [wsAlerts, setWsAlerts] = useState([]);

  // Alerta automático: bateria <= 10%
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

  // Remove alertas duplicados
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
  const firstVisibleDevice = filteredDevices.length === 0 ? 0 : startIndex + 1;
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

// ----------------------------------------------------------------------------
// COMPONENTE RAIZ (AUTENTICAÇÃO / SESSÃO)
// ----------------------------------------------------------------------------
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
