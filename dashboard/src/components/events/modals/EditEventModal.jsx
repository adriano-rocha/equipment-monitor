import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { updateEvent } from "../../../services/api";
import { GEOFENCE_OPTIONS } from "../constants";

// Helper para gerar 4 cantos padrão em volta de um ponto central
function generateDefaultPolygon(lat, lng) {
  const dLat = 0.0016; // ~170 metros norte-sul
  const dLng = 0.0010; // ~100 metros leste-oeste
  return [
    [lat + dLat, lng - dLng], // Canto 1 (Noroeste)
    [lat + dLat, lng + dLng], // Canto 2 (Nordeste)
    [lat - dLat, lng + dLng], // Canto 3 (Sudeste)
    [lat - dLat, lng - dLng], // Canto 4 (Sudoeste)
  ];
}

// Ícone para as 4 alças de canto do pavilhão
const cornerIcon = (num) =>
  L.divIcon({
    className: "modal-corner-handle",
    html: `
      <div style="
        background: #10b981;
        color: #ffffff;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 800;
        border: 2px solid #ffffff;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.95);
        cursor: grab;
      ">${num}</div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export function EditEventModal({ event, isOpen, onClose, onSuccess }) {
  const [name, setName] = useState(() => event?.name || "");
  const [location, setLocation] = useState(() => event?.location || "");
  const [geofenceRadius, setGeofenceRadius] = useState(() => event?.geofence_radius || 250);
  const [isActive] = useState(() => event?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Modo de cerca: 'polygon' ou 'circle'
  const [fenceType, setFenceType] = useState(() =>
    Array.isArray(event?.geofence_polygon) && event.geofence_polygon.length >= 3 ? "polygon" : "circle"
  );

  const [selectedCoords, setSelectedCoords] = useState(() => ({
    lat: event?.latitude ? Number(event.latitude) : -23.5159,
    lng: event?.longitude ? Number(event.longitude) : -46.6276,
  }));

  const [polygonCoords, setPolygonCoords] = useState(() => {
    if (Array.isArray(event?.geofence_polygon) && event.geofence_polygon.length >= 3) {
      return event.geofence_polygon;
    }
    return generateDefaultPolygon(
      event?.latitude ? Number(event.latitude) : -23.5159,
      event?.longitude ? Number(event.longitude) : -46.6276
    );
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);

  const miniMapContainerRef = useRef(null);
  const miniMapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const cornerMarkersRef = useRef([]);

  // Inicialização do Mapa
  useEffect(() => {
    if (!isOpen || !miniMapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (!miniMapInstanceRef.current && miniMapContainerRef.current) {
        const map = L.map(miniMapContainerRef.current, {
          center: [selectedCoords.lat, selectedCoords.lng],
          zoom: 16,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
          className: "asaph-dark-tiles",
        }).addTo(map);

        // Pino Central (Círculo)
        const pinIcon = L.divIcon({
          className: "modal-base-pin",
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
              font-size: 16px;
              border: 2px solid #ffffff;
              box-shadow: 0 0 10px rgba(2, 132, 199, 0.9);
              cursor: grab;
            ">🏢</div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([selectedCoords.lat, selectedCoords.lng], {
          icon: pinIcon,
          draggable: true,
        });

        const circle = L.circle([selectedCoords.lat, selectedCoords.lng], {
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.16,
          weight: 2,
          dashArray: "6, 8",
          radius: geofenceRadius,
        });

        // Polígono e Alças
        const polyLayer = L.polygon(polygonCoords, {
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.18,
          weight: 2.5,
          dashArray: "6, 8",
        });

        miniMapInstanceRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        polygonLayerRef.current = polyLayer;

        // Eventos do modo círculo
        marker.on("dragend", (e) => {
          const { lat, lng } = e.target.getLatLng();
          setSelectedCoords({ lat, lng });
          circle.setLatLng([lat, lng]);
        });

        map.on("click", (e) => {
          if (fenceType === "circle") {
            const { lat, lng } = e.latlng;
            setSelectedCoords({ lat, lng });
            marker.setLatLng([lat, lng]);
            circle.setLatLng([lat, lng]);
          }
        });

        renderFenceLayers(fenceType, map);
        map.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        polygonLayerRef.current = null;
        cornerMarkersRef.current = [];
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Alterna as camadas visíveis entre Círculo e Polígono
  function renderFenceLayers(type, mapInstance = miniMapInstanceRef.current) {
    if (!mapInstance) return;

    const marker = markerRef.current;
    const circle = circleRef.current;
    const polyLayer = polygonLayerRef.current;

    // Limpa alças anteriores
    cornerMarkersRef.current.forEach((m) => mapInstance.removeLayer(m));
    cornerMarkersRef.current = [];

    if (type === "circle") {
      if (polyLayer) mapInstance.removeLayer(polyLayer);
      if (marker) marker.addTo(mapInstance);
      if (circle) circle.addTo(mapInstance);
    } else {
      if (marker) mapInstance.removeLayer(marker);
      if (circle) mapInstance.removeLayer(circle);
      if (polyLayer) {
        polyLayer.setLatLngs(polygonCoords).addTo(mapInstance);
        mapInstance.fitBounds(polyLayer.getBounds(), { padding: [30, 30], maxZoom: 17 });
      }

      // Cria as 4 alças arrastáveis
      const handles = polygonCoords.map((coord, idx) => {
        const handle = L.marker(coord, {
          icon: cornerIcon(idx + 1),
          draggable: true,
          zIndexOffset: 1000 + idx,
        }).addTo(mapInstance);

        handle.on("drag", () => {
          const newLatLng = handle.getLatLng();
          setPolygonCoords((prev) => {
            const updated = [...prev];
            updated[idx] = [newLatLng.lat, newLatLng.lng];
            if (polygonLayerRef.current) {
              polygonLayerRef.current.setLatLngs(updated);
            }
            return updated;
          });
        });

        handle.on("dragend", () => {
          setPolygonCoords((latest) => {
            const centroidLat = latest.reduce((sum, p) => sum + p[0], 0) / latest.length;
            const centroidLng = latest.reduce((sum, p) => sum + p[1], 0) / latest.length;
            setSelectedCoords({ lat: centroidLat, lng: centroidLng });
            return latest;
          });
        });

        return handle;
      });

      cornerMarkersRef.current = handles;
    }
  }

  // Atualiza camadas ao trocar o tipo de cerca
  function handleToggleFenceType(type) {
    setFenceType(type);
    renderFenceLayers(type);
  }

  // Reposiciona o polígono no centro da visão atual
  function handleRecenterPolygon() {
    const map = miniMapInstanceRef.current;
    if (!map) return;
    const center = map.getCenter();
    const newCoords = generateDefaultPolygon(center.lat, center.lng);
    setPolygonCoords(newCoords);
    setSelectedCoords({ lat: center.lat, lng: center.lng });

    if (polygonLayerRef.current) {
      polygonLayerRef.current.setLatLngs(newCoords);
      map.fitBounds(polygonLayerRef.current.getBounds(), { padding: [30, 30] });
    }

    cornerMarkersRef.current.forEach((handle, idx) => {
      handle.setLatLng(newCoords[idx]);
    });
  }

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(geofenceRadius);
    }
  }, [geofenceRadius]);

  async function handleQuickSearch(e) {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchingLocation(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=br&limit=1`
      );
      const data = await resp.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        setSelectedCoords({ lat, lng });

        if (miniMapInstanceRef.current) {
          miniMapInstanceRef.current.setView([lat, lng], 16);
          if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
          if (circleRef.current) circleRef.current.setLatLng([lat, lng]);
        }

        if (fenceType === "polygon") {
          const newCoords = generateDefaultPolygon(lat, lng);
          setPolygonCoords(newCoords);
          if (polygonLayerRef.current) polygonLayerRef.current.setLatLngs(newCoords);
          cornerMarkersRef.current.forEach((handle, idx) => handle.setLatLng(newCoords[idx]));
        }
      } else {
        alert("Local não encontrado. Tente um nome de cidade ou bairro.");
      }
    } catch (err) {
      console.error("Erro na busca de localidade:", err);
    } finally {
      setSearchingLocation(false);
    }
  }

  if (!isOpen || !event) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    const trimmedName = name.trim();
    const trimmedLocation = location.trim();

    if (!trimmedName || !trimmedLocation) {
      setErrorMsg("Preencha o Nome do Evento e o Local.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        location: trimmedLocation,
        latitude: selectedCoords.lat,
        longitude: selectedCoords.lng,
        geofence_radius: fenceType === "circle" ? geofenceRadius : null,
        geofence_polygon: fenceType === "polygon" ? polygonCoords : null,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        is_active: isActive,
      };

      const updated = await updateEvent(event.id, payload);
      onSuccess(updated);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Erro ao atualizar evento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: "700px", width: "95%" }}>
        <div className="modal-header">
          <h3>✏️ Editar Evento & Cerca Virtual</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {errorMsg && <div className="modal-error">{errorMsg}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label>
                Nome do Evento <span className="required">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>
                Local / Referência <span className="required">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Seletor do Tipo de Cerca */}
          <div style={{ marginTop: "0.85rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc", display: "block", marginBottom: "0.4rem" }}>
              🛡️ Formato da Cerca Virtual:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => handleToggleFenceType("circle")}
                style={{
                  padding: "0.55rem 0.6rem",
                  borderRadius: "6px",
                  border: fenceType === "circle" ? "1.5px solid #10b981" : "1px solid #334155",
                  background: fenceType === "circle" ? "rgba(16, 185, 129, 0.15)" : "#0f172a",
                  color: fenceType === "circle" ? "#10b981" : "#94a3b8",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
              >
                ⭕ Círculo Convencional (Raio)
              </button>
              <button
                type="button"
                onClick={() => handleToggleFenceType("polygon")}
                style={{
                  padding: "0.55rem 0.6rem",
                  borderRadius: "6px",
                  border: fenceType === "polygon" ? "1.5px solid #10b981" : "1px solid #334155",
                  background: fenceType === "polygon" ? "rgba(16, 185, 129, 0.15)" : "#0f172a",
                  color: fenceType === "polygon" ? "#10b981" : "#94a3b8",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
              >
                📐 Pavilhão Poligonal (4 Cantos)
              </button>
            </div>
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#cbd5e1" }}>
                {fenceType === "polygon"
                  ? "Arraste as alças (1, 2, 3 e 4) sobre os cantos do pavilhão:"
                  : "Arraste o pino 🏢 ou clique no mapa para o centro da cerca:"}
              </label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  type="text"
                  placeholder="Buscar endereço/cidade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickSearch(e)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "4px",
                    color: "#f8fafc",
                    width: "180px",
                  }}
                />
                <button
                  type="button"
                  onClick={handleQuickSearch}
                  disabled={searchingLocation}
                  style={{
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.75rem",
                    background: "#334155",
                    border: "none",
                    borderRadius: "4px",
                    color: "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  {searchingLocation ? "..." : "Buscar"}
                </button>
              </div>
            </div>

            <div
              style={{
                width: "100%",
                height: "230px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid #334155",
                position: "relative",
              }}
            >
              <div ref={miniMapContainerRef} style={{ width: "100%", height: "100%" }} />

              {fenceType === "polygon" && (
                <button
                  type="button"
                  onClick={handleRecenterPolygon}
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    zIndex: 1000,
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid #10b981",
                    color: "#10b981",
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  }}
                >
                  🎯 Centralizar Pavilhão Aqui
                </button>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.4rem",
                fontSize: "0.75rem",
                color: "#94a3b8",
              }}
            >
              <span>
                Centroide:{" "}
                <b style={{ color: "#38bdf8" }}>
                  Lat: {selectedCoords.lat.toFixed(5)} | Lng: {selectedCoords.lng.toFixed(5)}
                </b>
              </span>
              <span>
                Cerca:{" "}
                <b style={{ color: "#10b981" }}>
                  {fenceType === "polygon" ? "4 Cantos Ajustados" : `${geofenceRadius}m de Raio`}
                </b>
              </span>
            </div>
          </div>

          {/* Opções de Raio (Apenas no Modo Círculo) */}
          {fenceType === "circle" && (
            <div className="form-group" style={{ marginTop: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.4rem" }}>
                Tamanho do Raio da Cerca:
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.5rem",
                }}
              >
                {GEOFENCE_OPTIONS.map((opt) => {
                  const isSelected = geofenceRadius === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGeofenceRadius(opt.value)}
                      style={{
                        padding: "0.5rem 0.35rem",
                        borderRadius: "6px",
                        border: isSelected ? "1px solid #10b981" : "1px solid #334155",
                        background: isSelected ? "rgba(16, 185, 129, 0.15)" : "#0f172a",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: isSelected ? "#10b981" : "#f8fafc",
                        }}
                      >
                        {opt.label}
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "#94a3b8",
                          marginTop: "0.15rem",
                        }}
                      >
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Salvando..." : "Atualizar Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}