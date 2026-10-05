"""Exceções da camada de aplicação — mapeadas para respostas HTTP."""


class InvalidDeviceCredentialsError(Exception):
    """Credencial de dispositivo inválida.

    Credencial ausente, malformada, inexistente, com secret incorreto
    ou revogada.
    """


class EventNotFoundError(Exception):
    """Evento solicitado não existe."""


class DeviceNotFoundError(Exception):
    """Equipamento solicitado não existe."""


class UserNotFoundError(Exception):
    """Usuário solicitado não existe."""


class EventDeviceNotFoundError(Exception):
    """Associação entre evento e equipamento não existe."""


class EventDeviceAlreadyActiveError(Exception):
    """Equipamento já possui associação ativa com o evento."""