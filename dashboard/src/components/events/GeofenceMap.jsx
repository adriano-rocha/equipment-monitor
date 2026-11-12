import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371e3;
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

// Algoritmo PNPOLY Canônico: Raio Horizontal Leste-Oeste imune à rotação de galpões
function isPointInPolygon(lat, lon, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  let j = n - 1;

  for (let i = 0; i < n; i++) {
    const latI = polygon[i][0];
    const lonI = polygon[i][1];
    const latJ = polygon[j][0];
    const lonJ = polygon[j][1];

    const intersect =
      latI > lat !== latJ > lat &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI;

    if (intersect) inside = !inside;
    j = i;
  }

  return inside;
}

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
  const hasInitialFitRef = useRef(false);

  // Reseta a centralização inicial se trocar de evento
  useEffect(() => {
    hasInitialFitRef.current = false;
  }, [event?.id]);

  const polygon =
    Array.isArray(event?.geofence_polygon) && event.geofence_polygon.length >= 3
      ? event.geofence_polygon
      : null;

  const centroid = polygon
    ? [
        polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length,
        polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length,
      ]
    : null;

  const baseLat = centroid ? centroid[0] : event?.latitude || -23.6477;
  const baseLng = centroid ? centroid[1] : event?.longitude || -46.6292;

  // 1. Inicialização do Mapa (Apenas uma vez)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [baseLat, baseLng],
        zoom: 16,
        zoomControl: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 120, // Suaviza o scroll para não saltar zoom rápido
        wheelDebounceTime: 80,
      });

      // Régua métrica tática no canto inferior direito
      L.control
        .scale({
          metric: true,
          imperial: false,
          position: "bottomright",
        })
        .addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
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

  // 2. Renderização de Camadas e Telemetria
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    const bounds = L.latLngBounds([[baseLat, baseLng]]);

    if (polygon) {
      const geofencePoly = L.polygon(polygon, {
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.16,
        weight: 2.5,
        dashArray: "6, 8",
      }).addTo(layers);

      geofencePoly.bindPopup(`
        <div style="color: #0f172a; font-family: sans-serif; padding: 4px;">
          <strong style="color: #059669; font-size: 13px;">🛡️ Perímetro Pavilhão</strong><br/>
          <b>Evento:</b> ${event?.name || "Evento"}<br/>
          <b>Cantos Demarcados:</b> ${polygon.length} pontos
        </div>
      `);

      bounds.extend(geofencePoly.getBounds());
    }

    devices.forEach((dev) => {
      const live = realtimeLocations[dev.id] || realtimeLocations[dev.device_id] || {};

      const isTarget =
        focusTarget?.deviceId === dev.id ||
        (focusTarget?.assetNumber && dev.asset_number === focusTarget.assetNumber);

      const label = dev.asset_number || "SIM-RASTREIO";

      let lat = live.lat || dev.latitude;
      let lng = live.lng || dev.longitude;

      if ((!lat || !lng) && isTarget && focusTarget) {
        lat = focusTarget.latitude;
        lng = focusTarget.longitude;
      }

      lat = lat || baseLat;
      lng = lng || baseLng;

      let distance = live.distance || live.distance_m;
      if (!distance || distance === 0) {
        distance = getDistanceMeters(baseLat, baseLng, lat, lng);
      }

      const insideGeofence = polygon ? isPointInPolygon(lat, lng, polygon) : true;
      const isAlert = !insideGeofence;

      let speed = live.speed || live.speed_kmh || focusTarget?.speed_kmh;
      if (!speed && focusTarget?.message) {
        const speedMatch = focusTarget.message.match(/([\d.]+)\s*km\/h/i);
        if (speedMatch) speed = speedMatch[1];
      }
      if (!speed) {
        speed = isAlert ? "68.0" : "3.0";
      }

      const icon = isAlert ? alertDeviceIcon(label) : normalTacticalIcon();
      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: isAlert ? 9999 : 100,
      }).addTo(layers);

      bounds.extend([lat, lng]);

      marker.bindTooltip(`📱 <b>${label}</b> (${dev.location_point || "Posto"})`, {
        direction: "top",
        offset: [0, -10],
        opacity: 0.9,
      });

      if (isAlert && (lat !== baseLat || lng !== baseLng)) {
        L.polyline([[baseLat, baseLng], [lat, lng]], {
          color: "#ef4444",
          weight: 2,
          dashArray: "6, 8",
        }).addTo(layers);
      }

      marker.bindPopup(`
        <div style="color: #0f172a; font-family: sans-serif; min-width: 190px; padding: 4px;">
          <div style="font-size: 13px; font-weight: 800; color: ${isAlert ? "#dc2626" : "#059669"}; margin-bottom: 6px;">
            ${isAlert ? "🚨 ALERTA: ROMPIMENTO DE CERCA" : "📱 " + label}
          </div>
          <div style="font-size: 12px; line-height: 1.5;">
            <b>Patrimônio:</b> ${label}<br/>
            <b>Tipo:</b> ${dev.device_type || "Smartphone"}<br/>
            <b>Posto:</b> ${dev.location_point || "Não atribuído"}<br/>
            <b>Distância:</b> <span style="color: ${isAlert ? "#dc2626" : "#059669"}; font-weight: bold;">${distance}m</span><br/>
            <b>Velocidade:</b> <b>${speed} km/h</b><br/>
            <b>Status:</b> ${isAlert ? '<span style="color: #dc2626; font-weight: bold;">FORA DO PERÍMETRO</span>' : '<span style="color: #059669; font-weight: bold;">SEGURO</span>'}
          </div>
        </div>
      `);

      if (isTarget) {
        marker.openPopup();
      }
    });

    // Centralização inteligente: enquadra 1 vez na abertura ou segue o foco selecionado
    if (!hasInitialFitRef.current && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      hasInitialFitRef.current = true;
    } else if (focusTarget?.latitude && focusTarget?.longitude) {
      map.panTo([focusTarget.latitude, focusTarget.longitude], { animate: true });
    }
  }, [baseLat, baseLng, polygon, devices, focusTarget, realtimeLocations, event]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "420px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #334155",
      }}
    >
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

      <div
        style={{
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
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#10b981" }}></span>{" "}
          Cerca Ativa (Pavilhão)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#059669",
              border: "1px solid #ffffff",
            }}
          ></span>{" "}
          Pinos Táticos (Seguros)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#ef4444",
            }}
          ></span>{" "}
          Rompimento / Fuga (Prioridade)
        </span>
      </div>
    </div>
  );
}

export default GeofenceMap;