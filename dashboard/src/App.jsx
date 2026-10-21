import { useEffect, useMemo, useState } from "react";

import { useDevices } from "./hooks/useDevices";
import Login from "./Login";
import {
  clearAccessToken,
  createDevice,
  getAccessToken,
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

const TABLE_COLUMNS = [
  "Patrimônio",
  "Tipo",
  "Hostname",
  "IP",
  "Bateria",
  "Status",
  "Último contato",
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
  if (!timestamp) {
    return "-";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

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

function getEmptyMessage({ totalDevices, hasError }) {
  if (totalDevices > 0) {
    return "Nenhum equipamento corresponde aos filtros selecionados.";
  }

  return hasError ? "Sem dados para exibir." : "Nenhum equipamento cadastrado.";
}

function DevicesTable({ devices, emptyMessage }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {TABLE_COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td className="asset-number">{device.asset_number ?? "-"}</td>
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
            </tr>
          ))}

          {devices.length === 0 && (
            <tr>
              <td colSpan={TABLE_COLUMNS.length} className="empty-state">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="Paginação dos equipamentos">
      <button
        type="button"
        className="pagination-button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Anterior
      </button>

      <span className="pagination-info" aria-live="polite">
        Página {currentPage} de {totalPages}
      </span>

      <button
        type="button"
        className="pagination-button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Próxima
      </button>
    </nav>
  );
}

// Modal de Cadastro de Equipamento
function CreateDeviceModal({ isOpen, onClose, onSuccess }) {
  const [assetNumber, setAssetNumber] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
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
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        serial_number: serialNumber.trim() || null,
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
      <div className="modal-card">
        <div className="modal-header">
          <h3>Cadastrar Novo Equipamento</h3>
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
            <label htmlFor="asset_number">
              Patrimônio <span className="required">*</span>
            </label>
            <input
              id="asset_number"
              type="text"
              placeholder="Ex: NB-DELL-001"
              value={assetNumber}
              onChange={(e) => setAssetNumber(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="device_type">Tipo de Equipamento</label>
            <select
              id="device_type"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
            >
              <option value="">Não informado</option>
              <option value="notebook">Notebook</option>
              <option value="tablet">Tablet</option>
              <option value="smartphone">Smartphone</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="manufacturer">Fabricante</label>
              <input
                id="manufacturer"
                type="text"
                placeholder="Ex: Dell, Samsung"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="model">Modelo</label>
              <input
                id="model"
                type="text"
                placeholder="Ex: Latitude 3420"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="serial_number">Número de Série</label>
            <input
              id="serial_number"
              type="text"
              placeholder="Opcional"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
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
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? "Cadastrando..." : "Cadastrar e Gerar Chave"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Exibição Única da Credencial (DeviceKey)
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
          <strong>Atenção:</strong> Esta é a <u>única vez</u> que o segredo
          (secret) será exibido. Copie e configure o agente agora.
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
          <button
            type="button"
            className="btn-secondary"
            onClick={copyBoth}
          >
            {copiedAll ? "Copiado Tudo!" : "Copiar Ambas as Chaves"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
          >
            Concluir e Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const { devices, loading, refreshing, error, lastUpdated, refresh } =
    useDevices();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [requestedPage, setRequestedPage] = useState(1);

  // Estados dos modais de cadastro e credenciais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdDeviceData, setCreatedDeviceData] = useState(null);

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

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setRequestedPage(1);
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value);
    setRequestedPage(1);
  }

  function handleCreateSuccess(newDeviceWithCredentials) {
    setIsCreateOpen(false);
    setCreatedDeviceData(newDeviceWithCredentials);
  }

  function handleCredentialsClosed() {
    setCreatedDeviceData(null);
    refresh();
  }

  if (loading) {
    return (
      <main className="dashboard-loading" aria-live="polite">
        <p>Carregando equipamentos...</p>
      </main>
    );
  }

  return (
    <main>
      <header className="dashboard-header">
        <div className="brand">
          <img src="/asaph.png" alt="Logo ASAPH" className="brand-logo" />
        </div>

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

      <section className="devices-section">
        <div className="section-header">
          <div>
            <h2>Equipamentos</h2>

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
            aria-label="Buscar equipamentos por patrimônio, hostname ou IP"
            placeholder="Buscar patrimônio, tipo, hostname ou IP..."
            value={search}
            onChange={handleSearchChange}
          />

          <div className="status-filters" aria-label="Filtrar por status">
            {STATUS_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={statusFilter === filter.value ? "active" : ""}
                aria-pressed={statusFilter === filter.value}
                onClick={() => handleStatusFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <DevicesTable
          devices={paginatedDevices}
          emptyMessage={getEmptyMessage({
            totalDevices: devices.length,
            hasError: Boolean(error),
          })}
        />

        {filteredDevices.length > 0 && (
          <div className="pagination-footer">
            <span className="pagination-count">
              Exibindo {firstVisibleDevice}–{lastVisibleDevice} de{" "}
              {filteredDevices.length} equipamentos
            </span>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setRequestedPage}
            />
          </div>
        )}
      </section>

      {/* Modal de Formulário de Cadastro */}
      <CreateDeviceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Modal de Exibição Única da Credencial */}
      <CredentialsDisplayModal
        deviceData={createdDeviceData}
        onClose={handleCredentialsClosed}
      />

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

  function handleLoginSuccess() {
    setAuthenticated(true);
  }

  function handleLogout() {
    clearAccessToken();
    setAuthenticated(false);
  }

  if (!authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

export default App;