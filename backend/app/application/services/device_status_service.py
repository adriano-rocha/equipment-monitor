from datetime import datetime, timedelta, timezone


ONLINE_THRESHOLD = timedelta(minutes=2)
SEM_COMUNICACAO_THRESHOLD = timedelta(minutes=5)


def calculate_communication_status(last_seen: datetime | None) -> str:
    if last_seen is None:
        return "SEM REGISTRO"

    now = datetime.now(timezone.utc)

    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)

    elapsed = now - last_seen

    if elapsed <= ONLINE_THRESHOLD:
        return "ONLINE"

    if elapsed <= SEM_COMUNICACAO_THRESHOLD:
        return "SEM COMUNICAÇÃO"

    return "OFFLINE"