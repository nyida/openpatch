'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceMarket = {
  title: string;
  platform: string;
  note?: string;
};

export type Workspace = {
  id: string;
  name: string;
  markets: WorkspaceMarket[];
  createdAt: number;
  updatedAt: number;
};

type WorkspaceState = {
  workspaces: Workspace[];
  createWorkspace: (name: string, markets?: WorkspaceMarket[]) => string;
  updateWorkspace: (id: string, patch: Partial<Pick<Workspace, 'name' | 'markets'>>) => void;
  deleteWorkspace: (id: string) => void;
  getWorkspace: (id: string) => Workspace | undefined;
  addMarketToWorkspace: (id: string, market: WorkspaceMarket) => void;
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      createWorkspace: (name, markets = []) => {
        const id = newId();
        const ws: Workspace = {
          id,
          name,
          markets,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ workspaces: [ws, ...s.workspaces] }));
        return id;
      },
      updateWorkspace: (id, patch) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w,
          ),
        })),
      deleteWorkspace: (id) => set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) })),
      getWorkspace: (id) => get().workspaces.find((w) => w.id === id),
      addMarketToWorkspace: (id, market) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => {
            if (w.id !== id) return w;
            if (w.markets.some((m) => m.title === market.title && m.platform === market.platform)) {
              return w;
            }
            return {
              ...w,
              markets: [...w.markets, market],
              updatedAt: Date.now(),
            };
          }),
        })),
    }),
    { name: 'algomarket_workspaces' },
  ),
);
