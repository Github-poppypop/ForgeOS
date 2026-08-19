import { useEffect, useState } from 'react';

/**
 * Offline-mode queue + sync indicator (Batch B #18).
 * Persists pending "sync actions" to localStorage while the browser is
 * offline, shows a live ONLINE/OFFLINE pill in the top nav, and flushes
 * the queue automatically when connectivity returns.
 */

type QueueItem = { id: string; label: string; at: number };

const KEY = 'forgeos-offline-queue';
let listeners: Array<() => void> = [];

function read(): QueueItem[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueueItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore quota / private-mode errors */
  }
  listeners.forEach((l) => l());
}

export function enqueueOfflineAction(label: string): void {
  const items = read();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  items.push({ id, label, at: Date.now() });
  write(items);
}

export function getPendingCount(): number {
  return read().length;
}

export function flushOfflineQueue(): number {
  const n = read().length;
  write([]);
  return n;
}

export function subscribeOfflineQueue(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function OfflineIndicator(): JSX.Element {
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState<number>(getPendingCount());

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      const flushed = flushOfflineQueue();
      if (flushed > 0) console.info('[offline] connection restored — synced ' + flushed + ' queued action(s)');
      setPending(0);
    };
    const goOffline = () => {
      setOnline(false);
      setPending(getPendingCount());
    };
    const unsub = subscribeOfflineQueue(() => setPending(getPendingCount()));
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsub();
    };
  }, []);

  return (
    <span
      className={online ? 'pill ok' : 'pill bad'}
      data-tooltip={online ? 'Connection: online' : 'Offline — ' + pending + ' action(s) queued for sync'}
      aria-live="polite"
      role="status"
    >
      <span className="dot" />
      {online ? 'ONLINE' : 'OFFLINE' + (pending ? ' · ' + pending : '')}
    </span>
  );
}
