import math
from typing import Tuple

class GeofenceService:
    # Raio da Terra em metros
    EARTH_RADIUS_METERS = 6371000

    @staticmethod
    def calcular_distancia_metros(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calcula a distância em metros entre duas coordenadas geográficas (Fórmula de Haversine).
        """
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

    @classmethod
    def validar_perimetro(
        cls, 
        device_coords: Tuple[float, float], 
        venue_center: Tuple[float, float] | None = None, 
        raio_maximo_metros: float | None = None,
        *,
        center_coords: Tuple[float, float] | None = None,
        raio_metros: float | None = None,
    ) -> Tuple[bool, float]:
        """
        Retorna (dentro_do_perimetro: bool, distancia_calculada: float).
        Aceita tanto venue_center quanto center_coords, e tanto raio_maximo_metros quanto raio_metros.
        """
        centro = venue_center or center_coords
        if centro is None:
            raise ValueError("As coordenadas centrais do evento não foram fornecidas.")

        raio = raio_maximo_metros if raio_maximo_metros is not None else (raio_metros if raio_metros is not None else 250.0)

        distancia = cls.calcular_distancia_metros(
            device_coords[0], device_coords[1],
            centro[0], centro[1]
        )
        dentro = distancia <= raio
        return dentro, round(distancia, 1)