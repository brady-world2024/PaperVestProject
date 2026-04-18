export function formatCurrency(value: number, minimumFractionDigits = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits,
  }).format(value ?? 0);
}

export function formatPercent(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatCurrency(value)}`;
}

export function formatShares(value: number) {
  return Number(value ?? 0).toFixed(value % 1 === 0 ? 0 : 4);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatMarketTimestamp(value: string, timezone = 'America/New_York') {
  const date = new Date(value);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `Updated at ${time} ${formatTimeZoneLabel(date, timezone)}`;
}

function formatTimeZoneLabel(date: Date, timezone: string) {
  if (timezone === 'America/New_York') {
    return 'ET';
  }

  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  return timeZoneName ?? timezone;
}
