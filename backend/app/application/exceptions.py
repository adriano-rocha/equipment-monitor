"""Exceções da camada de aplicação — mapeadas para respostas HTTP em T11."""


class InvalidDeviceCredentialsError(Exception):
    """Credencial de dispositivo ausente, malformada, inexistente, com secret
    incorreto ou revogada. Mapeada para HTTP 401 (T11) — a mensagem nunca
    diferencia qual desses casos ocorreu."""