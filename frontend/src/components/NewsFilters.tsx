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
    <div className="space-y-4">
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-300 mb-2">
          Search News
        </label>
        <input
          type="text"
          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          placeholder="Search by topics, keywords, sources, or domains..."
          value={local.q || ''}
          onChange={(e) => update('q', e.target.value)}
        />
      </div>
      <div className="text-xs text-gray-500">
        💡 Tip: Search for specific companies, sectors, or news sources
      </div>
    </div>
  );
}


