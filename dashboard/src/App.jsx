import { useEffect, useMemo, useState } from "react";

import { useDevices } from "./hooks/useDevices";
import Login from "./Login";
import { clearAccessToken, getAccessToken } from "./services/api";

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
<span className={`status-badge ${config.className}`}>
{config.label} </span>
);
}

function StatusCard({ title, count, className }) {
return (
<div className={`status-card ${className}`}> <span className="status-card-title">{title}</span> <strong className="status-card-count">{count}</strong> </div>
);
}

function getEmptyMessage({ totalDevices, hasError }) {
if (totalDevices > 0) {
return "Nenhum equipamento corresponde aos filtros selecionados.";
}

return hasError
? "Sem dados para exibir."
: "Nenhum equipamento cadastrado.";
}

function DevicesTable({ devices, emptyMessage }) {
return ( <div className="table-container"> <table> <thead> <tr>
{TABLE_COLUMNS.map((column) => ( <th key={column} scope="col">
{column} </th>
))} </tr> </thead>

```
    <tbody>
      {devices.map((device) => (
        <tr key={device.id}>
          <td className="asset-number">{device.asset_number ?? "-"}</td>
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
```

);
}

function Dashboard({ onLogout }) {
const { devices, loading, refreshing, error, lastUpdated, refresh } =
useDevices();

const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("TODOS");

const counts = useMemo(() => {
const result = {};

```
for (const device of devices) {
  result[device.status] = (result[device.status] ?? 0) + 1;
}

return result;
```

}, [devices]);

const filteredDevices = useMemo(() => {
const normalizedSearch = search.trim().toLowerCase();

```
return devices.filter((device) => {
  const matchesSearch =
    normalizedSearch === "" ||
    [device.asset_number, device.hostname, device.reported_ip].some(
      (value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(normalizedSearch),
    );

  const matchesStatus =
    statusFilter === "TODOS" || device.status === statusFilter;

  return matchesSearch && matchesStatus;
});
```

}, [devices, search, statusFilter]);

if (loading) {
return ( <main className="dashboard-loading" aria-live="polite"> <p>Carregando equipamentos...</p> </main>
);
}

return ( <main> <header className="dashboard-header"> <div className="brand"> <img
         src="/asaph.png"
         alt="Logo ASAPH"
         className="brand-logo"
       /> </div>

```
    <div className="device-total">
      <button
        type="button"
        className="logout-button"
        onClick={onLogout}
      >
        Sair
      </button>

      <span>Equipamentos monitorados</span>
      <strong>{devices.length}</strong>
    </div>
  </header>

  {error && (
    <div className="error-banner" role="alert">
      <span>{error}</span>
      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
      >
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
          Exibindo {filteredDevices.length} de {devices.length} equipamentos
        </span>
      </div>

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

    <div className="filters">
      <input
        type="search"
        aria-label="Buscar equipamentos por patrimônio, hostname ou IP"
        placeholder="Buscar patrimônio, hostname ou IP..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="status-filters" aria-label="Filtrar por status">
        {STATUS_FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.value}
            className={statusFilter === filter.value ? "active" : ""}
            aria-pressed={statusFilter === filter.value}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>

    <DevicesTable
      devices={filteredDevices}
      emptyMessage={getEmptyMessage({
        totalDevices: devices.length,
        hasError: Boolean(error),
      })}
    />
  </section>

  <footer className="dashboard-footer">
    <span>ASAPH | Grupo Pleno</span>
    <span>Monitoramento de ativos</span>
  </footer>
</main>
```

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

```
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
```

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
