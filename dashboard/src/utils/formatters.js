export const STATUS = {
  ONLINE: "ONLINE",
  WARNING: "SEM COMUNICAÇÃO",
  OFFLINE: "OFFLINE",
};

export const STATUS_BADGES = {
  [STATUS.ONLINE]: { label: "ONLINE", className: "status-online" },
  [STATUS.WARNING]: {
    label: "SEM COMUNICAÇÃO",
    className: "status-warning",
  },
  [STATUS.OFFLINE]: { label: "OFFLINE", className: "status-offline" },
};

export const SUMMARY_CARDS = [
  { status: STATUS.ONLINE, title: "ONLINE", className: "card-online" },
  {
    status: STATUS.WARNING,
    title: "SEM COMUNICAÇÃO",
    className: "card-warning",
  },
  { status: STATUS.OFFLINE, title: "OFFLINE", className: "card-offline" },
];

export const STATUS_FILTERS = [
  { value: "TODOS", label: "Todos" },
  { value: STATUS.ONLINE, label: "Online" },
  { value: STATUS.WARNING, label: "Sem comunicação" },
  { value: STATUS.OFFLINE, label: "Offline" },
];

export const brasiliaDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function formatBrasiliaDateTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  return brasiliaDateTimeFormatter.format(date);
}