import type { ArbitrageSpread } from '@/services/types';
import { formatNetROI } from '@/utils/arbMath';

const THRESHOLD_KEY = 'alert_threshold_cents';
const ENABLED_KEY = 'arb_alerts_enabled';
const DEFAULT_THRESHOLD = 5;
const COOLDOWN_MS = 5 * 60 * 1000;

const recentAlerts = new Map<string, number>();

export function getAlertThreshold(): number {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLD;
  const v = localStorage.getItem(THRESHOLD_KEY);
  const n = v ? parseFloat(v) : DEFAULT_THRESHOLD;
  return Number.isFinite(n) ? n : DEFAULT_THRESHOLD;
}

export function setAlertThreshold(cents: number) {
  localStorage.setItem(THRESHOLD_KEY, String(cents));
}

export function getAlertsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === 'true';
}

export function setAlertsEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

function venueLabel(spread: ArbitrageSpread): string {
  return spread.direction === 'buy_poly' ? 'Polymarket' : spread.direction === 'buy_kalshi' ? 'Kalshi' : '-';
}

function buyPrice(spread: ArbitrageSpread): number {
  if (spread.direction === 'buy_poly') return spread.poly_price;
  if (spread.direction === 'buy_kalshi') return spread.kalshi_price;
  return spread.poly_price;
}

export function shouldAlert(spread: ArbitrageSpread, thresholdCents: number): boolean {
  if (spread.net_profit_cents < thresholdCents) return false;
  const last = recentAlerts.get(spread.id);
  if (last && Date.now() - last < COOLDOWN_MS) return false;
  return true;
}

export function markAlerted(spreadId: string) {
  recentAlerts.set(spreadId, Date.now());
  recentAlerts.forEach((at, id) => {
    if (Date.now() - at > COOLDOWN_MS) recentAlerts.delete(id);
  });
}

export function sendArbNotification(spread: ArbitrageSpread) {
  if (!canNotify()) return;
  const venue = venueLabel(spread);
  const price = (buyPrice(spread) * 100).toFixed(1);
  const roi = formatNetROI(spread.roi);

  new Notification(`🚨 New Arb: ${spread.poly_title}`, {
    body: `Buy YES on ${venue} @ ${price}¢ | Net Profit: ${roi}`,
    icon: '/favicon.ico',
    tag: spread.id,
  });

  markAlerted(spread.id);
}

export function sendTestNotification() {
  if (!canNotify()) return;
  new Notification('Algomarket test alert', {
    body: 'Alerts are working. You will be notified when net profit exceeds your threshold.',
    icon: '/favicon.ico',
    tag: 'test-alert',
  });
}

export type AlertHistoryEntry = {
  id: string;
  title: string;
  netCents: number;
  at: number;
};

const HISTORY_KEY = 'arb_alert_history';
const MAX_HISTORY = 50;

export function getAlertHistory(): AlertHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as AlertHistoryEntry[];
  } catch {
    return [];
  }
}

export function pushAlertHistory(spread: ArbitrageSpread) {
  const entry: AlertHistoryEntry = {
    id: spread.id,
    title: spread.poly_title,
    netCents: spread.net_profit_cents,
    at: Date.now(),
  };
  const prev = getAlertHistory().filter((h) => h.id !== spread.id || Date.now() - h.at < COOLDOWN_MS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...prev].slice(0, MAX_HISTORY)));
}
