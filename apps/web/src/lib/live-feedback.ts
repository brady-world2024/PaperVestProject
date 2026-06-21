type LiveFeedbackTone = 'positive' | 'neutral' | 'caution';

type LiveFeedbackParams = {
  subject: string;
  timestamps: Array<string | null | undefined>;
  now: number;
  refreshIntervalMs: number;
  isRefreshing: boolean;
  stale?: boolean;
  degraded?: boolean;
};

export type LiveFeedbackStatus = {
  chip: string;
  relativeLabel: string;
  detail: string;
  cadenceLabel: string;
  tone: LiveFeedbackTone;
  pulse: boolean;
};

export function getLiveFeedbackStatus({
  subject,
  timestamps,
  now,
  refreshIntervalMs,
  isRefreshing,
  stale = false,
  degraded = false,
}: LiveFeedbackParams): LiveFeedbackStatus {
  const latestTimestamp = getLatestTimestamp(timestamps);
  const cadenceLabel = `Auto-refresh every ${formatRefreshCadence(refreshIntervalMs)}.`;
  const relativeLabel = latestTimestamp
    ? `Updated ${formatRelativeRefreshTime(latestTimestamp, now)}`
    : 'Waiting for first snapshot';

  if (isRefreshing) {
    return {
      chip: 'Refreshing',
      relativeLabel,
      detail: latestTimestamp
        ? `Pulling a fresher ${subject} snapshot now so the workspace stays synchronized.`
        : `Connecting the ${subject} feed for the first snapshot now.`,
      cadenceLabel,
      tone: 'positive',
      pulse: true,
    };
  }

  if (degraded || stale) {
    return {
      chip: degraded ? 'Degraded' : 'Cached',
      relativeLabel,
      detail: `Using the latest cached ${subject} snapshot until a cleaner live refresh lands.`,
      cadenceLabel,
      tone: 'caution',
      pulse: false,
    };
  }

  if (!latestTimestamp) {
    return {
      chip: 'Waiting',
      relativeLabel,
      detail: `No ${subject} snapshot has landed yet, so the workspace is still warming up.`,
      cadenceLabel,
      tone: 'neutral',
      pulse: false,
    };
  }

  const ageMs = Math.max(now - Date.parse(latestTimestamp), 0);

  if (ageMs <= refreshIntervalMs * 1.25) {
    return {
      chip: 'Live',
      relativeLabel,
      detail: `The latest ${subject} snapshot is still inside the live refresh window.`,
      cadenceLabel,
      tone: 'positive',
      pulse: true,
    };
  }

  if (ageMs <= refreshIntervalMs * 3.5) {
    return {
      chip: 'Delayed',
      relativeLabel,
      detail: `The ${subject} snapshot is still usable, but it is drifting beyond the usual refresh rhythm.`,
      cadenceLabel,
      tone: 'neutral',
      pulse: false,
    };
  }

  return {
    chip: 'Quiet',
    relativeLabel,
    detail: `The ${subject} snapshot has been quiet for a while, so refresh-sensitive decisions deserve a quick re-check.`,
    cadenceLabel,
    tone: 'caution',
    pulse: false,
  };
}

export function formatRelativeRefreshTime(timestamp: string, now = Date.now()) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return 'unknown';
  }

  const deltaSeconds = Math.max(Math.round((now - parsed) / 1000), 0);

  if (deltaSeconds < 5) {
    return 'just now';
  }

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}

export function getLatestTimestamp(timestamps: Array<string | null | undefined>) {
  let latestTimestamp: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const timestamp of timestamps) {
    if (!timestamp) {
      continue;
    }

    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed) || parsed <= latestMs) {
      continue;
    }

    latestMs = parsed;
    latestTimestamp = timestamp;
  }

  return latestTimestamp;
}

function formatRefreshCadence(refreshIntervalMs: number) {
  if (refreshIntervalMs % 60_000 === 0) {
    return `${refreshIntervalMs / 60_000}m`;
  }

  return `${Math.round(refreshIntervalMs / 1000)}s`;
}
