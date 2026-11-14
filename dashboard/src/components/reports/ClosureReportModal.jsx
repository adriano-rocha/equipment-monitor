import { useEffect, useState } from "react";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function csvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function createInventoryReport(devices) {
  if (!Array.isArray(devices)) {
    throw new Error("A API retornou um inventário em formato inesperado.");
  }

  const inventory = devices.map((device) => ({
    ...device,
    communication_status: device.status,
    operational_state: device.operational_state || "ATIVO",
  }));
  const pendingDevices = inventory.filter(
    (device) => device.operational_state !== "RECOLHIDO",
  );
  const collectedDevices = inventory.filter(
    (device) => device.operational_state === "RECOLHIDO",
  );
  const countsByType = {};

  inventory.forEach((device) => {
    const type = (device.device_type || "unknown").trim().toLowerCase();
    countsByType[type] = (countsByType[type] || 0) + 1;
  });

  return {
    report_type: "inventory",
    event_id: null,
    event_name: "Inventário Completo",
    generated_at: new Date().toISOString(),
    total_devices: inventory.length,
    total_collected: collectedDevices.length,
    total_pending: pendingDevices.length,
    collection_rate_percent: inventory.length
      ? (collectedDevices.length / inventory.length) * 100
      : 0,
    counts_by_type: countsByType,
    pending_devices: pendingDevices,
    collected_devices: collectedDevices,
  };
}

function downloadCsv(report) {
  const isInventoryReport = report.report_type === "inventory";
  const headings = isInventoryReport
    ? [
        "Situação",
        "Patrimônio",
        "Tipo",
        "Fabricante",
        "Modelo",
        "Número de Série",
        "Hostname",
        "IP",
        "Estado Operacional",
        "Status de Comunicação",
        "Bateria (%)",
        "Último Contato",
      ]
    : [
        "Situação",
        "Patrimônio",
        "Tipo",
        "Modelo",
        "Posto/Alocação Original",
        "Bateria (%)",
        "Estado Operacional",
        "Último Contato",
      ];
  const devices = [
    ...report.pending_devices.map((device) => ({
      ...device,
      closure_status: "PENDENTE",
    })),
    ...report.collected_devices.map((device) => ({
      ...device,
      closure_status: "RECOLHIDO",
    })),
  ];
  const rows = devices.map((device) =>
    isInventoryReport
      ? [
          device.closure_status,
          device.asset_number,
          device.device_type,
          device.manufacturer,
          device.model,
          device.serial_number,
          device.hostname,
          device.reported_ip,
          device.operational_state,
          device.communication_status,
          device.battery_level,
          formatDateTime(device.last_seen),
        ]
      : [
          device.closure_status,
          device.asset_number,
          device.device_type,
          device.model,
          device.location_point,
          device.battery_level,
          device.operational_state,
          formatDateTime(device.last_seen),
        ],
  );
  const csv = [headings, ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = isInventoryReport
    ? "romaneio-inventario-completo.csv"
    : `romaneio-fechamento-${report.event_id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function DeviceTable({ devices, pending = false, inventory = false }) {
  return (
    <div className={`closure-report-table-wrap${pending ? " is-pending" : ""}`}>
      <table className={`closure-report-table${inventory ? " is-inventory" : ""}`}>
        <thead>
          <tr>
            <th>Patrimônio</th>
            <th>Tipo</th>
            {inventory && <th>Fabricante</th>}
            <th>Modelo</th>
            {inventory && <th>Nº de Série</th>}
            {inventory && <th>Hostname</th>}
            {inventory && <th>IP</th>}
            {!inventory && <th>Posto / Alocação Original</th>}
            <th>Bateria</th>
            {inventory && <th>Estado Operacional</th>}
            {inventory && <th>Comunicação</th>}
            {(pending || inventory) && <th>Último Contato</th>}
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>{device.asset_number}</td>
              <td>{device.device_type || "—"}</td>
              {inventory && <td>{device.manufacturer || "—"}</td>}
              <td>{device.model || "—"}</td>
              {inventory && <td>{device.serial_number || "—"}</td>}
              {inventory && <td>{device.hostname || "—"}</td>}
              {inventory && <td>{device.reported_ip || "—"}</td>}
              {!inventory && <td>{device.location_point || "—"}</td>}
              <td>
                {typeof device.battery_level === "number"
                  ? `${device.battery_level}%`
                  : "—"}
              </td>
              {inventory && <td>{device.operational_state}</td>}
              {inventory && <td>{device.status || "—"}</td>}
              {(pending || inventory) && (
                <td>{formatDateTime(device.last_seen)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClosureReportModal({
  isOpen,
  mode = "event",
  onClose,
  eventId,
  eventName,
  apiBaseUrl,
  token,
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || (mode !== "inventory" && !eventId)) return undefined;

    const controller = new AbortController();

    const baseUrl = String(apiBaseUrl || "").replace(/\/+$/, "");
    const reportUrl =
      mode === "inventory"
        ? `${baseUrl}/api/v1/devices`
        : `${baseUrl}/api/v1/events/${eventId}/closure-report`;

    fetch(reportUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Não foi possível gerar o romaneio (HTTP ${response.status}).`,
          );
        }
        return response.json();
      })
      .then((data) => {
        setReport(mode === "inventory" ? createInventoryReport(data) : data);
      })
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message || "Erro ao carregar o romaneio.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [apiBaseUrl, eventId, isOpen, mode, token]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const generatedAt = report?.generated_at;
  const pendingDevices = report?.pending_devices || [];
  const collectedDevices = report?.collected_devices || [];
  const totalDevices = report?.total_devices || 0;
  const totalCollected = report?.total_collected || 0;
  const totalPending = report?.total_pending || 0;
  const collectionRate = report?.collection_rate_percent || 0;
  const isInventoryReport = report?.report_type === "inventory";

  return (
    <div
      className="closure-report-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="closure-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="closure-report-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="closure-report-toolbar">
          <strong>
            {mode === "inventory"
              ? "Romaneio do Inventário"
              : "Romaneio de Fechamento"}
          </strong>
          <div className="closure-report-actions">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!report}
            >
              Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(report)}
              disabled={!report}
            >
              Exportar CSV
            </button>
            <button type="button" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        <article
          className={`closure-report-document${isInventoryReport ? " is-inventory" : ""}`}
        >
          <header className="closure-report-header">
            <div className="closure-report-logo-container">
              <img src="/asaph.png" alt="Logo ASAPH" />
            </div>
            <div>
              <p className="closure-report-eyebrow">ASAPH TRACK</p>
              <h1 id="closure-report-title">
                {isInventoryReport
                  ? "ROMANEIO GERAL DO INVENTÁRIO"
                  : "TERMO DE AUDITORIA E DEVOLUÇÃO DE FROTA"}
              </h1>
              <p className="closure-report-event">{report?.event_name || eventName}</p>
              <p className="closure-report-generated">
                Emitido em: {formatDateTime(generatedAt)}
              </p>
            </div>
          </header>

          {loading && <p className="closure-report-message">Gerando relatório...</p>}
          {error && (
            <p className="closure-report-message is-error" role="alert">
              {error}
            </p>
          )}

          {report && (
            <>
              <section className="closure-report-kpis" aria-label="Indicadores">
                <div>
                  <span>{isInventoryReport ? "Total inventariado" : "Total alocado"}</span>
                  <strong>{totalDevices}</strong>
                </div>
                <div className="is-collected">
                  <span>{isInventoryReport ? "Recolhidos" : "Devolvidos / recolhidos"}</span>
                  <strong>{totalCollected}</strong>
                </div>
                <div className="is-pending">
                  <span>{isInventoryReport ? "Não recolhidos" : "Pendências / extravios"}</span>
                  <strong>{totalPending}</strong>
                </div>
                <div className="is-rate">
                  <span>Taxa de conclusão</span>
                  <strong>{collectionRate.toFixed(1)}%</strong>
                </div>
              </section>

              <section className="closure-report-section">
                <h2>{isInventoryReport ? "Dispositivos não recolhidos" : "Pendências de recolhimento"}</h2>
                {pendingDevices.length ? (
                  <DeviceTable
                    devices={pendingDevices}
                    pending={!isInventoryReport}
                    inventory={isInventoryReport}
                  />
                ) : (
                  <p className="closure-report-success">
                    100% dos equipamentos recolhidos com sucesso.
                  </p>
                )}
              </section>

              <section className="closure-report-section">
                <h2>{isInventoryReport ? "Dispositivos recolhidos" : "Equipamentos conferidos"}</h2>
                {collectedDevices.length ? (
                  <DeviceTable
                    devices={collectedDevices}
                    inventory={isInventoryReport}
                  />
                ) : (
                  <p className="closure-report-empty">
                    Nenhum equipamento recolhido registrado.
                  </p>
                )}
              </section>

              <footer className="closure-report-signatures">
                <div>
                  <span />
                  <p>Coordenação de TI (Asaph Track) - Assinatura / Data</p>
                </div>
                <div>
                  <span />
                  <p>Produção do Evento / Cliente - Nome / Documento / Assinatura</p>
                </div>
              </footer>
            </>
          )}
        </article>
      </section>
    </div>
  );
}
