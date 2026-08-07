/**
 * marketplace/analytics.ts
 *
 * Publisher analytics: track downloads and installs per publisher.
 */

export interface AnalyticsEvent {
  id: string;
  publisher: string;
  packageName: string;
  eventType: 'download' | 'install' | 'view';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PublisherStats {
  publisher: string;
  downloads: number;
  installs: number;
  views: number;
  lastActivity: string;
}

const events: AnalyticsEvent[] = [];
let idCounter = 0;

export function trackEvent(publisher: string, packageName: string, eventType: AnalyticsEvent['eventType'], metadata?: Record<string, unknown>): AnalyticsEvent {
  const event: AnalyticsEvent = {
    id: `evt-${++idCounter}`,
    publisher,
    packageName,
    eventType,
    timestamp: new Date().toISOString(),
    metadata,
  };
  events.push(event);
  return event;
}

export function getPublisherStats(publisher: string): PublisherStats {
  const publisherEvents = events.filter(e => e.publisher === publisher);
  const downloads = publisherEvents.filter(e => e.eventType === 'download').length;
  const installs = publisherEvents.filter(e => e.eventType === 'install').length;
  const views = publisherEvents.filter(e => e.eventType === 'view').length;
  const lastActivity = publisherEvents.length > 0 ? publisherEvents[publisherEvents.length - 1].timestamp : new Date().toISOString();
  return { publisher, downloads, installs, views, lastActivity };
}

export function getTopPublishers(limit = 10): PublisherStats[] {
  const publishers = new Set(events.map(e => e.publisher));
  const stats = Array.from(publishers).map(p => getPublisherStats(p));
  stats.sort((a, b) => (b.downloads + b.installs) - (a.downloads + a.installs));
  return stats.slice(0, limit);
}

/** Reset analytics state for tests. */
export function __resetForTests(): void {
  events.length = 0;
  idCounter = 0;
}
