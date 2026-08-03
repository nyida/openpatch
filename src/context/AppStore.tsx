'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UnifiedMarket } from '@/services/types';

type AppStoreValue = {
  searchResults: UnifiedMarket[];
  setSearchResults: (r: UnifiedMarket[]) => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [searchResults, setSearchResults] = useState<UnifiedMarket[]>([]);

  const value = useMemo(
    () => ({
      searchResults,
      setSearchResults,
    }),
    [searchResults],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}
