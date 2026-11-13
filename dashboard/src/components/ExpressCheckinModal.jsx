import { useCallback, useEffect, useRef, useState } from "react";

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
  const cameraSupported =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => {
      window.clearTimeout(focusTimer);
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  // Contagem dinâmica
  const recolhidosCount =
    initialRecolhidos +
    sessionHistory.filter((item) => !item.already_collected).length;
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
        setSessionHistory((prev) => [
          {
            id: data.id,
            asset_number: data.asset_number,
            device_type: data.device_type,
            model: data.model,
            already_collected: data.already_collected,
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

  // Câmera nativa via BarcodeDetector
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);

        const barcodeDetector = new window.BarcodeDetector();
        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                handleCheckin(detectedVal);
              }
            } catch {
              // Frame dropped, segue em frente
            }
          }
        }, 400);
      }
    } catch {
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
      stopCamera();
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
              stopCamera();
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

          {cameraSupported && (
            <div className="checkin-camera-actions">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="btn-secondary"
                >
                  Ler com câmera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="btn-ghost-danger"
                >
                  Parar câmera
                </button>
              )}
            </div>
          )}

          {cameraActive && (
            <div className="checkin-viewfinder">
              <video
                ref={videoRef}
                playsInline
                aria-label="Imagem da câmera para leitura do código"
              />
              <div className="checkin-scan-frame" />
            </div>
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
                key={`${item.id}-${item.time}`}
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
                    }`}
                  >
                    {item.already_collected ? "JÁ ESTAVA" : "RECOLHIDO"}
                  </span>
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