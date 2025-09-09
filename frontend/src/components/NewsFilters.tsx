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
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm"
          placeholder="Search articles, topics, sources..."
          value={local.q || ''}
          onChange={(e) => update('q', e.target.value)}
        />
      </div>
    </div>
  );
}


