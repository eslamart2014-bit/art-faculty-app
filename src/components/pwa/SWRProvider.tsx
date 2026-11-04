"use client";

import { SWRConfig } from 'swr';
import React, { useEffect, useState } from 'react';

// Safely parse local storage cache
const getLocalCache = () => {
  if (typeof window === 'undefined') return new Map();
  try {
    const stored = localStorage.getItem('app-cache');
    if (stored) {
      return new Map(JSON.parse(stored));
    }
  } catch (e) {}
  return new Map();
};

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<any>(null);

  useEffect(() => {
    const map = getLocalCache();
    
    // Create a custom provider wrapper that syncs to localStorage on set/delete asynchronously
    const syncMap = new Map(map);
    
    let saveTimeout: any = null;
    const saveToLocal = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        try {
          const runSave = () => {
            try {
              localStorage.setItem('app-cache', JSON.stringify(Array.from(syncMap.entries())));
            } catch (e) {}
          };
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(runSave, { timeout: 1000 });
          } else {
            runSave();
          }
        } catch (e) {}
      }, 400);
    };

    const originalSet = syncMap.set.bind(syncMap);
    syncMap.set = (key, value) => {
      originalSet(key, value);
      saveToLocal();
      return syncMap;
    };

    const originalDelete = syncMap.delete.bind(syncMap);
    syncMap.delete = (key) => {
      const res = originalDelete(key);
      saveToLocal();
      return res;
    };

    setProvider(syncMap);

    return () => {
      if (saveTimeout) clearTimeout(saveTimeout);
    };
  }, []);

  if (!provider) {
    return <>{children}</>;
  }

  return (
    <SWRConfig value={{ 
      provider: () => provider,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      shouldRetryOnError: false 
    }}>
      {children}
    </SWRConfig>
  );
}
