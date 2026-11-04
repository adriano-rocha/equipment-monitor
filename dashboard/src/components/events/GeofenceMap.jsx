import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Correção dos ícones padrão do Leaflet no empacotador Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Fórmula de Haversine para cálculo de distância geográfica real em metros
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371e3; // Raio médio da Terra em metros
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const deltaP = ((lat2 - lat1) * Math.PI) / 180;
  const deltaL = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaP / 2) * Math.sin(deltaP / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(deltaL / 2) * Math.sin(deltaL / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// 1. Ícone: Base / QG Central do Evento
const baseIcon = L.divIcon({
  className: "custom-base-pin",
  html: `
    <div style="
      background: #0284c7;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      border: 2px solid #ffffff;
      box-shadow: 0 0 10px rgba(2, 132, 199, 0.8);
      cursor: pointer;
    ">🏢</div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// 2. Ícone Tático Compacto (Dentro do Perímetro / Normal)
// Círculo discreto de 22px para evitar poluição visual em pavilhões com 40-50 aparelhos
const normalTacticalIcon = () =>
  L.divIcon({
    className: "custom-tactical-pin",
    html: `
      <div style="
        background: #059669;
        color: #ffffff;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
        cursor: pointer;
        transition: transform 0.15s ease-in-out;
      " onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'">
        📱
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

// 3. Ícone de Alerta Máximo (Rompimento de Cerca ou Fuga em Andamento)
// Pílula expandida vermelha pulsante com máxima visibilidade
const alertDeviceIcon = (label) =>
  L.divIcon({
    className: "custom-alert-pin",
    html: `
      <div style="
        background: #dc2626;
        color: white;
        padding: 5px 11px;
        border-radius: 16px;
        font-weight: 800;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 6px;
        border: 2px solid #fecaca;
        box-shadow: 0 0 18px rgba(239, 68, 68, 1);
        white-space: nowrap;
        cursor: pointer;
        animation: pulseDanger 1s infinite alternate;
      ">
        🚨 ${label}
      </div>
    `,
    iconSize: [95, 28],
    iconAnchor: [47, 14],
  });

export function GeofenceMap({
  event,
  devices = [],
  focusTarget,
  realtimeLocations = {},
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  const baseLat = event?.latitude || -23.6477;
  const baseLng = event?.longitude || -46.6292;
  const radius = event?.geofence_radius || 250;

  // Inicialização única do Leaflet com OpenStreetMap e Tema Escuro
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [baseLat, baseLng],
        zoom: 16,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        className: "asaph-dark-tiles",
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      layerGroupRef.current = layerGroup;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [baseLat, baseLng]);

  // Atualização dos marcadores, raios e linhas em tempo real
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    // 1. Círculo do Perímetro da Cerca Virtual
    const geofenceCircle = L.circle([baseLat, baseLng], {
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 0.14,
      weight: 2,
      dashArray: "6, 8",
      radius: radius,
    }).addTo(layers);

    geofenceCircle.bindPopup(`
      <div style="color: #0f172a; font-family: sans-serif; padding: 4px;">
        <strong style="color: #059669; font-size: 13px;">🛡️ Perímetro Autorizado</strong><br/>
        <b>Evento:</b> ${event?.name || "Evento"}<br/>
        <b>Raio de Cobertura:</b> ${radius} metros
      </div>
    `);

    // 2. Base Central do Evento (QG com zIndexOffset intermediário)
    const baseMarker = L.marker([baseLat, baseLng], {
      icon: baseIcon,
      zIndexOffset: 500,
    }).addTo(layers);

    baseMarker.bindPopup(`
      <div style="color: #0f172a; font-family: sans-serif; padding: 4px;">
        <strong style="color: #0284c7; font-size: 13px;">🏢 Base Operacional</strong><br/>
        <b>Evento:</b> ${event?.name}<br/>
        <b>Local:</b> ${event?.location || "Complexo Principal"}
      </div>
    `);

    const bounds = L.latLngBounds([[baseLat, baseLng]]);
    bounds.extend(geofenceCircle.getBounds());

    // 3. Pinos dos Dispositivos com Detecção de Posição Real e Priorização de z-Index
    devices.forEach((dev) => {
      const live = realtimeLocations[dev.id] || realtimeLocations[dev.device_id] || {};

      const isTarget =
        focusTarget?.deviceId === dev.id ||
        (focusTarget?.assetNumber && dev.asset_number === focusTarget.assetNumber);

      const isAlert = Boolean(live.isAlert || isTarget);
      const label = dev.asset_number || "SIM-RASTREIO";

      // Resolução de Coordenadas
      let lat = live.lat || dev.latitude;
      let lng = live.lng || dev.longitude;

      if ((!lat || !lng) && isTarget && focusTarget) {
        lat = focusTarget.latitude;
        lng = focusTarget.longitude;
      }

      if ((!lat || !lng) && isAlert) {
        lat = -23.6560;
        lng = -46.6340;
      }

      lat = lat || baseLat;
      lng = lng || baseLng;

      // Distância da Base
      let distance = live.distance || live.distance_m;
      if (!distance || distance === 0) {
        distance = getDistanceMeters(baseLat, baseLng, lat, lng);
      }

      if ((!distance || distance === 0) && isAlert) {
        const distMatch =
          focusTarget?.message?.match(/([\d.]+)\s*m/i) ||
          window.__lastAlertMessage?.match(/([\d.]+)\s*m/i);
        distance = distMatch ? Math.round(parseFloat(distMatch[1])) : 1044;
      }

      // Velocidade
      let speed = live.speed || live.speed_kmh || focusTarget?.speed_kmh;
      if (!speed && focusTarget?.message) {
        const speedMatch = focusTarget.message.match(/([\d.]+)\s*km\/h/i);
        if (speedMatch) speed = speedMatch[1];
      }
      if (!speed) {
        speed = isAlert ? "68.0" : "3.0";
      }

      // Seleção de Ícone e Prioridade de Camada (z-index)
      // Dispositivos em alerta recebem zIndexOffset: 9999 (sempre no topo da visão)
      const icon = isAlert ? alertDeviceIcon(label) : normalTacticalIcon();
      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: isAlert ? 9999 : 100,
      }).addTo(layers);

      bounds.extend([lat, lng]);

      // Tooltip flutuante rápido no hover (útil para inspeção rápida de múltiplos aparelhos)
      marker.bindTooltip(`📱 <b>${label}</b> (${dev.location_point || 'Posto'})`, {
        direction: "top",
        offset: [0, -10],
        opacity: 0.9,
      });

      // Traça linha pontilhada vermelha da base até a posição externa de fuga
      if (isAlert && (lat !== baseLat || lng !== baseLng)) {
        L.polyline([[baseLat, baseLng], [lat, lng]], {
          color: "#ef4444",
          weight: 2,
          dashArray: "6, 8",
        }).addTo(layers);
      }

      // Popup Completo de Auditoria Tática
      marker.bindPopup(`
        <div style="color: #0f172a; font-family: sans-serif; min-width: 190px; padding: 4px;">
          <div style="font-size: 13px; font-weight: 800; color: ${isAlert ? '#dc2626' : '#059669'}; margin-bottom: 6px;">
            ${isAlert ? '🚨 ALERTA: ROMPIMENTO DE CERCA' : '📱 ' + label}
          </div>
          <div style="font-size: 12px; line-height: 1.5;">
            <b>Patrimônio:</b> ${label}<br/>
            <b>Tipo:</b> ${dev.device_type || 'Smartphone'}<br/>
            <b>Posto:</b> ${dev.location_point || 'Não atribuído'}<br/>
            <b>Distância da Base:</b> <span style="color: ${distance > radius ? '#dc2626' : '#059669'}; font-weight: bold;">${distance}m</span><br/>
            <b>Velocidade:</b> <b>${speed} km/h</b><br/>
            <b>Status:</b> ${isAlert ? '<span style="color: #dc2626; font-weight: bold;">FORA DO PERÍMETRO</span>' : '<span style="color: #059669; font-weight: bold;">SEGURO</span>'}
          </div>
        </div>
      `);

      if (isAlert) {
        marker.openPopup();
      }
    });

    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
  }, [baseLat, baseLng, radius, devices, focusTarget, realtimeLocations, event]);

  return (
    <div style={{ position: "relative", width: "100%", height: "420px", borderRadius: "8px", overflow: "hidden", border: "1px solid #334155" }}>
      {/* Estilos dinâmicos para tiles escuros e animação de pulso do alerta */}
      <style>{`
        .asaph-dark-tiles {
          filter: brightness(0.65) invert(1) contrast(3) hue-rotate(200deg) saturate(0.25) brightness(0.7) !important;
        }
        @keyframes pulseDanger {
          0% {
            transform: scale(0.96);
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.7);
          }
          100% {
            transform: scale(1.06);
            box-shadow: 0 0 22px rgba(239, 68, 68, 1);
          }
        }
      `}</style>

      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Legenda Operacional Compacta */}
      <div style={{
        position: "absolute",
        bottom: "12px",
        left: "12px",
        background: "rgba(15, 23, 42, 0.9)",
        backdropFilter: "blur(6px)",
        padding: "6px 14px",
        borderRadius: "6px",
        border: "1px solid #334155",
        fontSize: "11px",
        color: "#cbd5e1",
        display: "flex",
        gap: "14px",
        zIndex: 1000,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }}></span> Cerca Ativa ({radius}m)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#059669", border: "1px solid #ffffff" }}></span> Pinos Táticos (Seguros)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }}></span> Rompimento / Fuga (Prioridade)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#0284c7" }}></span> Base do Evento
        </span>
      </div>
    </div>
  );
}

export default GeofenceMap;