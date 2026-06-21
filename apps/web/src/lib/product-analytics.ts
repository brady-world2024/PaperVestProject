import type { ProductAnalyticsEventName, ProductAnalyticsWindowDays } from '@papervest/shared-types';

export function formatProductAnalyticsEventName(eventName: ProductAnalyticsEventName) {
  return eventName
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function formatProductAnalyticsPath(path: string) {
  const normalizedPath = path.split('?')[0]?.split('#')[0]?.trim() ?? '';
  if (!normalizedPath || normalizedPath === '/') {
    return 'Home';
  }

  return normalizedPath
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/[-_]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    )
    .join(' / ');
}

export function formatProductAnalyticsWindowLabel(windowDays: ProductAnalyticsWindowDays) {
  return `Last ${windowDays} days`;
}
