import React, { useState, useEffect, useRef } from "react";

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
  const [cameraSupported, setCameraSupported] = useState(false);

  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Foco automático e permanente no campo de entrada
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      setCameraSupported("BarcodeDetector" in window);
    } else {
      stopCamera();
      setInputCode("");
      setLastMessage(null);
    }
  }, [isOpen]);

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
            text: `⚠️ ${data.asset_number} já estava recolhido.`,
          });
        } else {
          playSound("success");
          setLastMessage({
            type: "success",
            text: `✅ ${data.asset_number} (${data.device_type || "dispositivo"}) recolhido com sucesso!`,
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
    } catch (err) {
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
            } catch (scanErr) {
              // Frame dropped, segue em frente
            }
          }
        }, 400);
      }
    } catch (err) {
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold">
                ⚡
              </span>
              <h2 className="text-xl font-bold text-white">
                Check-in Express (Fechamento)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Bipagem de leitor USB, câmera ou auto-submit de 4 dígitos.
            </p>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Barra de Progresso / KPIs */}
        <div className="px-6 py-4 bg-slate-950/20 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              Equipamentos Recolhidos
            </span>
            <div className="text-2xl font-black text-white flex items-baseline gap-2">
              <span className="text-emerald-400">{recolhidosCount}</span>
              <span className="text-slate-500 text-sm font-semibold">
                / {totalDevices} ({progressPercent}%)
              </span>
            </div>
          </div>
          <div className="w-36 bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Input & Controles */}
        <div className="p-6 space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputCode}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite os 4 dígitos ou bipe a etiqueta..."
              className="w-full bg-slate-950 border-2 border-emerald-500/50 focus:border-emerald-400 text-white text-xl font-mono px-4 py-3.5 rounded-xl outline-none placeholder:text-slate-600 shadow-inner"
              disabled={loading}
              autoFocus
            />
            {loading && (
              <div className="absolute right-4 top-4 text-emerald-400 animate-spin text-sm">
                ⏳
              </div>
            )}
          </div>

          {/* Feedback de Status */}
          {lastMessage && (
            <div
              className={`p-3 rounded-lg text-sm font-medium transition-all ${
                lastMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : lastMessage.type === "warning"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
              }`}
            >
              {lastMessage.text}
            </div>
          )}

          {/* Botão de Câmera (se suportado pelo navegador) */}
          {cameraSupported && (
            <div className="flex justify-end">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="text-xs flex items-center gap-1.5 text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                >
                  📷 Ler com Câmera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="text-xs flex items-center gap-1.5 text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 px-3 py-1.5 rounded-lg transition-colors border border-rose-800/40"
                >
                  ⏹ Parar Câmera
                </button>
              )}
            </div>
          )}

          {/* Viewfinder da Câmera */}
          {cameraActive && (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-emerald-500/60 rounded-lg pointer-events-none m-8 animate-pulse" />
            </div>
          )}
        </div>

        {/* Histórico da Sessão */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2 border-t border-slate-800/80 pt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Bipados nesta sessão ({sessionHistory.length})
          </div>
          {sessionHistory.length === 0 ? (
            <div className="text-center py-6 text-slate-600 text-sm">
              Nenhum equipamento bipado ainda. Comece a escanear!
            </div>
          ) : (
            sessionHistory.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.already_collected ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                  />
                  <span className="font-mono font-bold text-white">
                    {item.asset_number}
                  </span>
                  <span className="text-xs text-slate-400">
                    {item.device_type || "dispositivo"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500">
                    {item.time}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.already_collected
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {item.already_collected ? "JÁ ESTAVA" : "RECOLHIDO"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}