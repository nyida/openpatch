'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/whale/fetch';

type SourceStatus = {
  source: string;
  available: boolean;
  requires_key: boolean;
  has_key: boolean;
};

type DataSourcesResponse = {
  sources: SourceStatus[];
};

export function DataSourcesBanner() {
  const [sources, setSources] = useState<SourceStatus[] | null>(null);

  useEffect(() => {
    fetchJson<DataSourcesResponse>('/api/data_sources')
      .then((data) => setSources(data.sources ?? []))
      .catch(() => setSources(null));
  }, []);

  if (!sources) return null;

  const live = sources.filter((s) => s.available && (!s.requires_key || s.has_key));
  const optional = sources.filter((s) => s.requires_key && !s.has_key);

  return (
    <div className="data-sources-banner">
      <span className="data-sources-label">{live.length} sources live</span>
      <div className="data-sources-pills">
        {live.map((s) => (
          <span key={s.source} className="data-source-pill data-source-pill--ok">
            {s.source}
          </span>
        ))}
        {optional.map((s) => (
          <span key={s.source} className="data-source-pill data-source-pill--key" title="Set API key to enable">
            {s.source}
          </span>
        ))}
      </div>
    </div>
  );
}
