"""Serviço de cálculo de perímetro e geofencing (Circular e Poligonal)."""

import math
from typing import Sequence, Tuple


class GeofenceService:
    # Raio médio da Terra em metros (WGS-84)
    EARTH_RADIUS_METERS = 6371000

    @staticmethod
    def calcular_distancia_metros(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calcula a distância em metros entre duas coordenadas geográficas (Fórmula de Haversine)."""
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

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
        Algoritmo Ray-Casting (Point-in-Polygon / Jordan Curve).
        Dispara um raio horizontal a partir do ponto (lat, lon) e conta quantas
        arestas do polígono são intersectadas. Número ímpar = dentro; par = fora.
        
        Suporta qualquer polígono fechado de 4 ou mais cantos com qualquer rotação/orientação.
        """
        if not poligono or len(poligono) < 3:
            return False

        n = len(poligono)
        dentro = False
        j = n - 1

        for i in range(n):
            lat_i, lon_i = poligono[i][0], poligono[i][1]
            lat_j, lon_j = poligono[j][0], poligono[j][1]

            # Verifica se o raio cruza o segmento entre os vértices j e i
            cruzou = ((lon_i > lon) != (lon_j > lon)) and (
                lat < (lat_j - lat_i) * (lon - lon_i) / (lon_j - lon_i) + lat_i
            )

            if cruzou:
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
        device_lat, device_lon = device_coords

        # ----------------------------------------------------
        # 1. MODO POLIGONAL (Pavilhões, galpões, áreas complexas)
        # ----------------------------------------------------
        if geofence_polygon and len(geofence_polygon) >= 3:
            dentro = cls.ponto_dentro_do_poligono(device_lat, device_lon, geofence_polygon)

            # Para telemetria/relatório de distância, calcula distância até o centro
            # Se houver venue_center usa ele; senão, calcula o centroide do polígono
            if venue_center or center_coords:
                centro = venue_center or center_coords
            else:
                centro_lat = sum(p[0] for p in geofence_polygon) / len(geofence_polygon)
                centro_lon = sum(p[1] for p in geofence_polygon) / len(geofence_polygon)
                centro = (centro_lat, centro_lon)

            distancia = cls.calcular_distancia_metros(
                device_lat, device_lon,
                centro[0], centro[1],
            )
            return dentro, round(distancia, 1)

        # ----------------------------------------------------
        # 2. MODO CIRCULAR CONVENCIONAL (Legado)
        # ----------------------------------------------------
        centro = venue_center or center_coords
        if centro is None:
            raise ValueError("As coordenadas centrais do evento não foram fornecidas.")

        raio = raio_maximo_metros if raio_maximo_metros is not None else (raio_metros if raio_metros is not None else 250.0)

        distancia = cls.calcular_distancia_metros(
            device_lat, device_lon,
            centro[0], centro[1],
        )
        dentro = distancia <= raio
        return dentro, round(distancia, 1)