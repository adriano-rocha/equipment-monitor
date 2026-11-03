import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { updateEvent } from "../../../services/api";
import { GEOFENCE_OPTIONS } from "../constants";

export function EditEventModal({ event, isOpen, onClose, onSuccess }) {
  const [name, setName] = useState(() => event?.name || "");
  const [location, setLocation] = useState(() => event?.location || "");
  const [geofenceRadius, setGeofenceRadius] = useState(
    () => event?.geofence_radius || 250
  );
  const [isActive] = useState(() => event?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [selectedCoords, setSelectedCoords] = useState(() => ({
    lat: event?.latitude ? Number(event.latitude) : -23.5159,
    lng: event?.longitude ? Number(event.longitude) : -46.6276,
  }));

  const [searchQuery, setSearchQuery] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);

  const miniMapContainerRef = useRef(null);
  const miniMapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !miniMapContainerRef.current) return;

    const initialLat = selectedCoords.lat;
    const initialLng = selectedCoords.lng;

    const timer = setTimeout(() => {
      if (!miniMapInstanceRef.current && miniMapContainerRef.current) {
        const map = L.map(miniMapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: 16,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
          className: "asaph-dark-tiles",
        }).addTo(map);

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

        const marker = L.marker([initialLat, initialLng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        const circle = L.circle([initialLat, initialLng], {
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.16,
          weight: 2,
          dashArray: "6, 8",
          radius: geofenceRadius,
        }).addTo(map);

        map.on("click", (e) => {
          const { lat, lng } = e.latlng;
          setSelectedCoords({ lat, lng });
          marker.setLatLng([lat, lng]);
          circle.setLatLng([lat, lng]);
        });

        marker.on("dragend", (e) => {
          const { lat, lng } = e.target.getLatLng();
          setSelectedCoords({ lat, lng });
          circle.setLatLng([lat, lng]);
        });

        miniMapInstanceRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;

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
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const updated = await updateEvent(event.id, {
        name: trimmedName,
        location: trimmedLocation,
        latitude: selectedCoords.lat,
        longitude: selectedCoords.lng,
        geofence_radius: geofenceRadius,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        is_active: isActive,
      });

      onSuccess(updated);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Erro ao atualizar evento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: "680px", width: "95%" }}>
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

          <div style={{ marginTop: "0.75rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
                📍 Ajustar Centro da Cerca (Clique no mapa ou arraste o pino 🏢):
              </label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  type="text"
                  placeholder="Buscar cidade/endereço..."
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
                    width: "200px",
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
                  {searchingLocation ? "..." : "Localizar"}
                </button>
              </div>
            </div>

            <div
              style={{
                width: "100%",
                height: "220px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid #334155",
                position: "relative",
              }}
            >
              <div ref={miniMapContainerRef} style={{ width: "100%", height: "100%" }} />
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
                Coordenadas da Base:{" "}
                <b style={{ color: "#38bdf8" }}>
                  Lat: {selectedCoords.lat.toFixed(5)} | Lng: {selectedCoords.lng.toFixed(5)}
                </b>
              </span>
              <span>
                Raio Ativo: <b style={{ color: "#10b981" }}>{geofenceRadius} metros</b>
              </span>
            </div>
          </div>

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