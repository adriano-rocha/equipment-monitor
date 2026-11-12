"""Serviço de cálculo de perímetro e geofencing (Circular e Poligonal)."""

import math
from typing import Sequence, Tuple


class GeofenceService:
    # Raio médio da Terra em metros (WGS-84)
    EARTH_RADIUS_METERS = 6371000

    @staticmethod
    def calcular_distancia_metros(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calcula a distância em metros entre duas coordenadas geográficas (Fórmula de Haversine)."""
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        delta_phi = math.radians(float(lat2) - float(lat1))
        delta_lambda = math.radians(float(lon2) - float(lon1))

        a = (
            math.sin(delta_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return GeofenceService.EARTH_RADIUS_METERS * c

    @staticmethod
    def ponto_dentro_do_poligono(
        lat: float,
        lon: float,
        poligono: Sequence[Sequence[float]],
    ) -> bool:
        """
        Algoritmo Ray-Casting canônico (PNPOLY - W. Randolph Franklin).
        Dispara um raio horizontal para o Leste a partir de (lat, lon)
        ao longo da linha de latitude.
        Imune à rotação de pavilhões e arestas verticais.
        """
        if not poligono or len(poligono) < 3:
            return False

        n = len(poligono)
        dentro = False
        j = n - 1

        lat_ponto = float(lat)
        lon_ponto = float(lon)

        for i in range(n):
            lat_i, lon_i = float(poligono[i][0]), float(poligono[i][1])
            lat_j, lon_j = float(poligono[j][0]), float(poligono[j][1])

            # Verifica se a latitude do ponto está entre as latitudes dos vértices j e i
            if (lat_i > lat_ponto) != (lat_j > lat_ponto):
                # Calcula a longitude onde o segmento cruza a latitude do ponto
                lon_intersect = (lon_j - lon_i) * (lat_ponto - lat_i) / (lat_j - lat_i) + lon_i

                # Se o cruzamento ocorre a leste (direita) do ponto, conta a interseção
                if lon_ponto < lon_intersect:
                    dentro = not dentro

            j = i

        return dentro

    @classmethod
    def validar_perimetro(
        cls,
        device_coords: Tuple[float, float],
        venue_center: Tuple[float, float] | None = None,
        raio_maximo_metros: float | None = None,
        *,
        center_coords: Tuple[float, float] | None = None,
        raio_metros: float | None = None,
        geofence_polygon: Sequence[Sequence[float]] | None = None,
    ) -> Tuple[bool, float]:
        """
        Retorna (dentro_do_perimetro: bool, distancia_calculada: float).

        - Se geofence_polygon estiver definido (mínimo 3 pontos), usa Ray-Casting.
        - Caso contrário, usa cálculo circular Haversine legado.
        """
        device_lat, device_lon = float(device_coords[0]), float(device_coords[1])

        # ----------------------------------------------------
        # 1. MODO POLIGONAL (Pavilhões, galpões, áreas complexas)
        # ----------------------------------------------------
        if geofence_polygon and len(geofence_polygon) >= 3:
            dentro = cls.ponto_dentro_do_poligono(device_lat, device_lon, geofence_polygon)

            # Para telemetria/relatório de distância, calcula distância até o centro
            # Se houver venue_center usa ele; senão, calcula o centroide do polígono
            if venue_center or center_coords:
                raw_center = venue_center or center_coords
                centro = (float(raw_center[0]), float(raw_center[1]))
            else:
                centro_lat = sum(float(p[0]) for p in geofence_polygon) / len(geofence_polygon)
                centro_lon = sum(float(p[1]) for p in geofence_polygon) / len(geofence_polygon)
                centro = (centro_lat, centro_lon)

            distancia = cls.calcular_distancia_metros(
                device_lat, device_lon,
                centro[0], centro[1],
            )
            return dentro, round(distancia, 1)

        # ----------------------------------------------------
        # 2. MODO CIRCULAR CONVENCIONAL (Legado)
        # ----------------------------------------------------
        raw_center = venue_center or center_coords
        if raw_center is None:
            raise ValueError("As coordenadas centrais do evento não foram fornecidas.")

        centro = (float(raw_center[0]), float(raw_center[1]))
        raio = (
            float(raio_maximo_metros)
            if raio_maximo_metros is not None
            else (float(raio_metros) if raio_metros is not None else 250.0)
        )

        distancia = cls.calcular_distancia_metros(
            device_lat, device_lon,
            centro[0], centro[1],
        )
        dentro = distancia <= raio
        return dentro, round(distancia, 1)