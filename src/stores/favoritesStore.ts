'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SavedMarket = {
  title: string;
  platform: string;
  savedAt: number;
};

type FavoritesState = {
  followedTraders: string[];
  savedMarkets: SavedMarket[];
  toggleFollow: (wallet: string) => void;
  isFollowing: (wallet: string) => boolean;
  saveMarket: (title: string, platform: string) => void;
  unsaveMarket: (title: string, platform: string) => void;
  isMarketSaved: (title: string, platform: string) => boolean;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      followedTraders: [],
      savedMarkets: [],
      toggleFollow: (wallet) =>
        set((s) => ({
          followedTraders: s.followedTraders.includes(wallet)
            ? s.followedTraders.filter((w) => w !== wallet)
            : [...s.followedTraders, wallet],
        })),
      isFollowing: (wallet) => get().followedTraders.includes(wallet),
      saveMarket: (title, platform) =>
        set((s) => {
          const key = `${platform}::${title}`;
          if (s.savedMarkets.some((m) => `${m.platform}::${m.title}` === key)) return s;
          return {
            savedMarkets: [{ title, platform, savedAt: Date.now() }, ...s.savedMarkets].slice(0, 50),
          };
        }),
      unsaveMarket: (title, platform) =>
        set((s) => ({
          savedMarkets: s.savedMarkets.filter(
            (m) => !(m.title === title && m.platform === platform),
          ),
        })),
      isMarketSaved: (title, platform) =>
        get().savedMarkets.some((m) => m.title === title && m.platform === platform),
    }),
    { name: 'algomarket_favorites' },
  ),
);
