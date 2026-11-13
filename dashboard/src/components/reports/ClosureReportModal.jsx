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

function downloadCsv(report) {
  const headings = [
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
    ...report.pending_devices.map((device) => ({ ...device, status: "PENDENTE" })),
    ...report.collected_devices.map((device) => ({ ...device, status: "RECOLHIDO" })),
  ];
  const rows = devices.map((device) => [
    device.status,
    device.asset_number,
    device.device_type,
    device.model,
    device.location_point,
    device.battery_level,
    device.operational_state,
    formatDateTime(device.last_seen),
  ]);
  const csv = [headings, ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `romaneio-fechamento-${report.event_id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function DeviceTable({ devices, pending = false }) {
  return (
    <div className={`closure-report-table-wrap${pending ? " is-pending" : ""}`}>
      <table className="closure-report-table">
        <thead>
          <tr>
            <th>Patrimônio</th>
            <th>Tipo</th>
            <th>Modelo</th>
            <th>Posto / Alocação Original</th>
            <th>Bateria</th>
            {pending && <th>Último Contato</th>}
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>{device.asset_number}</td>
              <td>{device.device_type || "—"}</td>
              <td>{device.model || "—"}</td>
              <td>{device.location_point || "—"}</td>
              <td>
                {typeof device.battery_level === "number"
                  ? `${device.battery_level}%`
                  : "—"}
              </td>
              {pending && <td>{formatDateTime(device.last_seen)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClosureReportModal({
  isOpen,
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
    if (!isOpen || !eventId) return undefined;

    const controller = new AbortController();

    const baseUrl = String(apiBaseUrl || "").replace(/\/+$/, "");
    fetch(`${baseUrl}/api/v1/events/${eventId}/closure-report`, {
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
      .then(setReport)
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message || "Erro ao carregar o romaneio.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [apiBaseUrl, eventId, isOpen, token]);

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
          <strong>Romaneio de Fechamento</strong>
          <div className="closure-report-actions">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!report}
            >
              📄 Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(report)}
              disabled={!report}
            >
              📊 Exportar CSV
            </button>
            <button type="button" onClick={onClose}>
              ✕ Fechar
            </button>
          </div>
        </div>

        <article className="closure-report-document">
          <header className="closure-report-header">
            <img src="/asaph.png" alt="ASAPH Track" />
            <div>
              <p className="closure-report-eyebrow">ASAPH TRACK</p>
              <h1 id="closure-report-title">
                TERMO DE AUDITORIA E DEVOLUÇÃO DE FROTA
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
                  <span>Total alocado</span>
                  <strong>{totalDevices}</strong>
                </div>
                <div className="is-collected">
                  <span>Devolvidos / recolhidos</span>
                  <strong>{totalCollected}</strong>
                </div>
                <div className="is-pending">
                  <span>Pendências / extravios</span>
                  <strong>{totalPending}</strong>
                </div>
                <div className="is-rate">
                  <span>Taxa de conclusão</span>
                  <strong>{collectionRate.toFixed(1)}%</strong>
                </div>
              </section>

              <section className="closure-report-section">
                <h2>Pendências de recolhimento</h2>
                {pendingDevices.length ? (
                  <DeviceTable devices={pendingDevices} pending />
                ) : (
                  <p className="closure-report-success">
                    ✅ 100% dos equipamentos recolhidos com sucesso!
                  </p>
                )}
              </section>

              <section className="closure-report-section">
                <h2>Equipamentos conferidos</h2>
                {collectedDevices.length ? (
                  <DeviceTable devices={collectedDevices} />
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
