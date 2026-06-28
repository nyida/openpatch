'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlertType = 'price' | 'whale' | 'arb';

export type AppAlert = {
  id: string;
  type: AlertType;
  label: string;
  marketTitle?: string;
  spreadId?: string;
  threshold?: number;
  createdAt: number;
  read: boolean;
  triggeredAt?: number;
};

type AlertsState = {
  alerts: AppAlert[];
  addAlert: (alert: Omit<AppAlert, 'id' | 'createdAt' | 'read'>) => void;
  removeAlert: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: () => number;
  triggerAlert: (id: string) => void;
};

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set, get) => ({
      alerts: [],
      addAlert: (alert) =>
        set((s) => ({
          alerts: [
            {
              ...alert,
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              createdAt: Date.now(),
              read: false,
            },
            ...s.alerts,
          ].slice(0, 100),
        })),
      removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
      markRead: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
        })),
      markAllRead: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })) })),
      unreadCount: () => get().alerts.filter((a) => !a.read).length,
      triggerAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, triggeredAt: Date.now(), read: false } : a,
          ),
        })),
    }),
    { name: 'algomarket_alerts' },
  ),
);
