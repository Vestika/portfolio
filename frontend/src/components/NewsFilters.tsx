import { useState } from 'react';

export type NewsFiltersValue = {
  q?: string;
  topics?: string[]; // optional advanced use
  keywords?: string[]; // optional advanced use
  sources?: string[]; // optional advanced use
};

export default function NewsFilters({ value, onChange }: { value: NewsFiltersValue; onChange: (v: NewsFiltersValue) => void }) {
  const [local, setLocal] = useState<NewsFiltersValue>(value);

  function update<K extends keyof NewsFiltersValue>(key: K, val: NewsFiltersValue[K]) {
    const next = { ...local, [key]: val };
    setLocal(next);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col w-full">
        <input
          type="text"
          className="border rounded px-3 py-2 w-full"
          placeholder="Search news (topics, keywords, sources/domains)"
          value={local.q || ''}
          onChange={(e) => update('q', e.target.value)}
        />
      </div>
    </div>
  );
}


