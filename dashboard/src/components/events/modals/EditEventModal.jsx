import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { updateEvent } from "../../../services/api";

function generateDefaultPolygon(lat, lng) {
  const dLat = 0.0016;
  const dLng = 0.0010;
  return [
    [lat + dLat, lng - dLng],
    [lat + dLat, lng + dLng],
    [lat - dLat, lng + dLng],
    [lat - dLat, lng - dLng],
  ];
}

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
  const [isActive] = useState(() => event?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const initialLat = event?.latitude ? Number(event.latitude) : -23.5159;
  const initialLng = event?.longitude ? Number(event.longitude) : -46.6276;

  const [selectedCoords, setSelectedCoords] = useState(() => ({
    lat: initialLat,
    lng: initialLng,
  }));

  const [polygonCoords, setPolygonCoords] = useState(() => {
    if (Array.isArray(event?.geofence_polygon) && event.geofence_polygon.length >= 3) {
      return event.geofence_polygon;
    }
    return generateDefaultPolygon(initialLat, initialLng);
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);

  const miniMapContainerRef = useRef(null);
  const miniMapInstanceRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const cornerMarkersRef = useRef([]);

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

        const polyLayer = L.polygon(polygonCoords, {
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.18,
          weight: 2.5,
          dashArray: "6, 8",
        }).addTo(map);

        map.fitBounds(polyLayer.getBounds(), { padding: [30, 30], maxZoom: 17 });

        const handles = polygonCoords.map((coord, idx) => {
          const handle = L.marker(coord, {
            icon: cornerIcon(idx + 1),
            draggable: true,
            zIndexOffset: 1000 + idx,
          }).addTo(map);

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

        miniMapInstanceRef.current = map;
        polygonLayerRef.current = polyLayer;
        cornerMarkersRef.current = handles;

        map.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
        polygonLayerRef.current = null;
        cornerMarkersRef.current = [];
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

        const newCoords = generateDefaultPolygon(lat, lng);
        setPolygonCoords(newCoords);

        if (miniMapInstanceRef.current) {
          miniMapInstanceRef.current.setView([lat, lng], 16);
        }
        if (polygonLayerRef.current) {
          polygonLayerRef.current.setLatLngs(newCoords);
        }
        cornerMarkersRef.current.forEach((handle, idx) => handle.setLatLng(newCoords[idx]));
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
        geofence_polygon: polygonCoords,
        geofence_radius: null,
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
          <h3>Editar Evento & Pavilhão</h3>
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

          <div style={{ marginTop: "0.85rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text)" }}>
                Arraste as 4 alças (1, 2, 3 e 4) sobre os cantos do pavilhão:
              </label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  type="text"
                  placeholder="Buscar endereço..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickSearch(e)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    minHeight: "32px",
                    background: "var(--color-input)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-control)",
                    color: "var(--color-text)",
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
                    minHeight: "32px",
                    background: "#1a1d21",
                    border: "1px solid #2d333b",
                    borderRadius: "var(--radius-control)",
                    color: "var(--color-text)",
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
                height: "250px",
                borderRadius: "6px",
                overflow: "hidden",
                border: "1px solid var(--color-border)",
                position: "relative",
              }}
            >
              <div ref={miniMapContainerRef} style={{ width: "100%", height: "100%" }} />

              <button
                type="button"
                onClick={handleRecenterPolygon}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  zIndex: 1000,
                  minHeight: "32px",
                  background: "#1a1d21",
                  border: "1px solid #2d333b",
                  color: "var(--color-text)",
                  fontSize: "11px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  boxShadow: "none",
                }}
              >
                Centralizar Pavilhão Aqui
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.4rem",
                fontSize: "0.75rem",
                color: "var(--color-muted)",
              }}
            >
              <span>
                Centroide do Pavilhão:{" "}
                <b style={{ color: "var(--color-text)" }}>
                  Lat: {selectedCoords.lat.toFixed(5)} | Lng: {selectedCoords.lng.toFixed(5)}
                </b>
              </span>
              <span>
                Perímetro: <b>4 Cantos Demarcados</b>
              </span>
            </div>
          </div>

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