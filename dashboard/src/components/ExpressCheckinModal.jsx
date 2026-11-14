import { useCallback, useEffect, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

// Feedback sonoro nativo via Web Audio API (sem arquivos externos)
const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "success") {
      // Bip agudo e limpo de sucesso (880Hz)
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "duplicate") {
      // Duplo chirp de aviso (já recolhido)
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === "error") {
      // Buzzer grave de erro
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.25);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn("Audio Context blocked or unsupported", err);
  }
};

export default function ExpressCheckinModal({
  isOpen,
  onClose,
  totalDevices = 0,
  initialRecolhidos = 0,
  onCheckinSuccess,
  apiBaseUrl,
  token,
}) {
  const [inputCode, setInputCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [undoingIds, setUndoingIds] = useState(() => new Set());
  const [initialRecolhidosAtOpen] = useState(() => initialRecolhidos);

  const inputRef = useRef(null);
  const sessionHistorySequenceRef = useRef(0);
  const html5QrCodeRef = useRef(null);
  const cameraStartPromiseRef = useRef(null);
  const cameraStopPromiseRef = useRef(null);
  const cameraScannedCodesRef = useRef(new Set());

  const stopCamera = useCallback(() => {
    if (cameraStopPromiseRef.current) return cameraStopPromiseRef.current;

    const html5QrCode = html5QrCodeRef.current;
    if (!html5QrCode) {
      setCameraActive(false);
      return Promise.resolve();
    }

    const cleanupPromise = Promise.resolve()
      .then(async () => {
        const startPromise = cameraStartPromiseRef.current;
        if (startPromise) {
          try {
            await startPromise;
          } catch {
            // startCamera displays the startup error and cleanup continues here.
          }
        }

        if (html5QrCode.isScanning) {
          await html5QrCode.stop().then(() => html5QrCode.clear());
        } else {
          html5QrCode.clear();
        }
      })
      .catch((error) => {
        console.error("Erro ao liberar a câmera:", error);
        setLastMessage({
          type: "error",
          text: "Não foi possível desligar a câmera. Tente parar a câmera novamente.",
        });
      })
      .finally(() => {
        if (!html5QrCode.isScanning && html5QrCodeRef.current === html5QrCode) {
          html5QrCodeRef.current = null;
        }
        setCameraActive(html5QrCode.isScanning);
        cameraStopPromiseRef.current = null;
      });

    cameraStopPromiseRef.current = cleanupPromise;
    return cleanupPromise;
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => {
      window.clearTimeout(focusTimer);
      void stopCamera();
    };
  }, [isOpen, stopCamera]);

  const sessionDeviceStates = new Map();
  for (const item of sessionHistory) {
    const current = sessionDeviceStates.get(item.id);
    if (!current) {
      sessionDeviceStates.set(item.id, {
        firstSequence: item.sequence,
        initiallyCollected: item.already_collected,
        latestSequence: item.sequence,
        currentlyCollected: !item.reactivated,
      });
      continue;
    }

    if (item.sequence < current.firstSequence) {
      current.firstSequence = item.sequence;
      current.initiallyCollected = item.already_collected;
    }
    if (item.sequence > current.latestSequence) {
      current.latestSequence = item.sequence;
      current.currentlyCollected = !item.reactivated;
    }
  }

  const sessionCountDelta = [...sessionDeviceStates.values()].reduce(
    (total, device) => {
      if (device.initiallyCollected) {
        return total - (device.currentlyCollected ? 0 : 1);
      }
      return total + (device.currentlyCollected ? 1 : 0);
    },
    0,
  );
  const recolhidosCount = Math.max(
    0,
    initialRecolhidosAtOpen + sessionCountDelta,
  );
  const progressPercent = totalDevices
    ? Math.min(100, Math.round((recolhidosCount / totalDevices) * 100))
    : 0;

  const handleCheckin = async (codeToSubmit) => {
    const raw = (codeToSubmit || inputCode).trim();
    if (!raw || loading) return;

    setLoading(true);
    setInputCode("");

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/devices/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ asset_code: raw }),
      });

      const data = await res.json();

      if (!res.ok) {
        playSound("error");
        setLastMessage({
          type: "error",
          text: data.detail || `Erro ao processar patrimônio '${raw}'.`,
        });
      } else {
        if (data.already_collected) {
          playSound("duplicate");
          setLastMessage({
            type: "warning",
            text: `${data.asset_number} já estava recolhido.`,
          });
        } else {
          playSound("success");
          setLastMessage({
            type: "success",
            text: `${data.asset_number} (${data.device_type || "dispositivo"}) recolhido com sucesso.`,
          });
          if (onCheckinSuccess) onCheckinSuccess(data);
        }

        // Adiciona ao topo do histórico
        sessionHistorySequenceRef.current += 1;
        setSessionHistory((prev) => [
          {
            id: data.id,
            sequence: sessionHistorySequenceRef.current,
            asset_number: data.asset_number,
            device_type: data.device_type,
            model: data.model,
            already_collected: data.already_collected,
            reactivated: false,
            time: new Date().toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
          ...prev,
        ]);
      }
    } catch {
      playSound("error");
      setLastMessage({
        type: "error",
        text: "Falha de conexão com o servidor.",
      });
    } finally {
      setLoading(false);
      // Mantém o cursor focado para a próxima leitura imediata
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleUndoCheckin = async (item) => {
    const deviceState = sessionDeviceStates.get(item.id);
    if (
      loading ||
      item.reactivated ||
      undoingIds.has(item.id) ||
      deviceState?.latestSequence !== item.sequence
    ) {
      return;
    }

    setUndoingIds((previous) => new Set(previous).add(item.id));
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/devices/undo-checkin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ device_id: item.id }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Não foi possível desfazer o recolhimento.");
      }

      setSessionHistory((previous) =>
        previous.map((entry) =>
          entry.id === item.id && entry.sequence === item.sequence
            ? { ...entry, reactivated: true }
            : entry,
        ),
      );
      playSound("success");
      setLastMessage({
        type: "success",
        text: `${data.asset_number} retornou ao estado ATIVO.`,
      });
      if (onCheckinSuccess) onCheckinSuccess(data);
    } catch (error) {
      playSound("error");
      setLastMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Falha ao desfazer o recolhimento.",
      });
    } finally {
      setUndoingIds((previous) => {
        const next = new Set(previous);
        next.delete(item.id);
        return next;
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Auto-submit para digitação de 4 dígitos (ex: 0142)
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputCode(val);

    // Se o operador digitou exatamente 4 dígitos numéricos, dispara sozinho
    if (/^\d{4}$/.test(val.trim())) {
      handleCheckin(val.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCheckin();
    }
  };

  // Câmera via html5-qrcode, compatível com navegadores móveis.
  const startCamera = async () => {
    if (html5QrCodeRef.current || cameraStopPromiseRef.current) return;

    const html5QrCode = new Html5Qrcode("reader-viewfinder", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });
    html5QrCodeRef.current = html5QrCode;
    setLastMessage(null);

    const config = {
      fps: 15,
      qrbox: (viewfinderWidth, viewfinderHeight) => ({
        width: Math.min(320, viewfinderWidth),
        height: Math.min(130, viewfinderHeight),
      }),
      aspectRatio: 1.777778,
    };
    let startPromise;
    cameraScannedCodesRef.current.clear();

    try {
      startPromise = html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (cameraScannedCodesRef.current.has(decodedText)) return;
          cameraScannedCodesRef.current.add(decodedText);
          handleCheckin(decodedText);
        },
        () => {},
      );
      cameraStartPromiseRef.current = startPromise;
      await startPromise;
      setCameraActive(true);
    } catch (error) {
      if (cameraStartPromiseRef.current === startPromise) {
        cameraStartPromiseRef.current = null;
      }
      const errorMessage =
        error instanceof Error ? ` ${error.message}` : "";
      setLastMessage({
        type: "error",
        text: `Não foi possível acessar a câmera. Verifique as permissões.${errorMessage}`,
      });
      await stopCamera();
    } finally {
      if (cameraStartPromiseRef.current === startPromise) {
        cameraStartPromiseRef.current = null;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="checkin-backdrop">
      <section
        className="checkin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
      >
        <header className="checkin-header">
          <div>
            <span className="filter-group-label">ASAPH TRACK / OPERAÇÃO</span>
            <h2 id="checkin-title">Check-in Express</h2>
            <p>
              Bipagem de leitor USB, câmera ou auto-submit de 4 dígitos.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost checkin-close"
            aria-label="Fechar check-in"
            onClick={() => {
              void stopCamera();
              onClose();
            }}
          >
            Fechar
          </button>
        </header>

        <section className="checkin-progress" aria-label="Progresso de recolhimento">
          <div>
            <span className="checkin-progress-label">
              Equipamentos recolhidos
            </span>
            <div className="checkin-progress-value">
              <strong>{recolhidosCount}</strong>
              <span>
                / {totalDevices} ({progressPercent}%)
              </span>
            </div>
          </div>
          <div
            className="checkin-progress-track"
            role="progressbar"
            aria-label="Percentual de equipamentos recolhidos"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="checkin-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>

        <div className="checkin-content">
          <div className="checkin-code-field">
            <input
              ref={inputRef}
              type="text"
              value={inputCode}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite os 4 dígitos ou bipe a etiqueta..."
              className="checkin-code-input"
              aria-label="Código de patrimônio"
              disabled={loading}
              autoFocus
            />
            {loading && (
              <span className="checkin-loader" role="status" aria-label="Processando" />
            )}
          </div>

          {lastMessage && (
            <div
              className={`checkin-feedback is-${lastMessage.type}`}
              role="status"
            >
              {lastMessage.text}
            </div>
          )}

          <div className="checkin-camera-actions">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="btn-secondary checkin-camera-button"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="checkin-camera-icon"
                >
                  <path
                    d="M4 7.5h3l1.5-2h7l1.5 2h3A1.5 1.5 0 0 1 21.5 9v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="13"
                    r="3.25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                Ler com Câmera
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopCamera()}
                className="btn-ghost-danger"
              >
                Parar câmera
              </button>
            )}
          </div>

          <div
            className={`checkin-viewfinder-slot${cameraActive ? " is-active" : ""}`}
          >
            <div
              id="reader-viewfinder"
              className="checkin-viewfinder"
              role="region"
              aria-label="Visor da câmera para leitura do código"
            />
          </div>
          {cameraActive && (
            <p className="checkin-camera-hint">
              Aponte para o código de barras a cerca de 20 cm de distância para
              foco nítido.
            </p>
          )}

          <section className="checkin-history" aria-label="Histórico de leitura da sessão">
            <div className="checkin-history-heading">
              Lidos nesta sessão ({sessionHistory.length})
            </div>
          {sessionHistory.length === 0 ? (
            <div className="checkin-history-empty">
              Nenhum equipamento lido nesta sessão.
            </div>
          ) : (
            sessionHistory.map((item) => (
              <div
                key={`${item.id}-${item.sequence}`}
                className="checkin-history-item"
              >
                <div className="checkin-history-device">
                  <strong>
                    {item.asset_number}
                  </strong>
                  <span>
                    {item.device_type || "dispositivo"}
                  </span>
                </div>
                <div className="checkin-history-meta">
                  <time>
                    {item.time}
                  </time>
                  <span
                    className={`checkin-history-state ${
                      item.already_collected ? "is-existing" : ""
                    }${item.reactivated ? " is-reactivated" : ""}`}
                  >
                    {item.reactivated
                      ? "REATIVADO"
                      : item.already_collected
                        ? "JÁ ESTAVA"
                        : "RECOLHIDO"}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost checkin-undo-button"
                    onClick={() => handleUndoCheckin(item)}
                    disabled={
                      loading ||
                      undoingIds.has(item.id) ||
                      item.reactivated ||
                      sessionDeviceStates.get(item.id)?.latestSequence !==
                        item.sequence
                    }
                    aria-label={`Desfazer recolhimento de ${item.asset_number}`}
                  >
                    {undoingIds.has(item.id) ? "Desfazendo..." : "↩ Desfazer"}
                  </button>
                </div>
              </div>
            ))
          )}
          </section>
        </div>
      </section>
    </div>
  );
}