import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { fuzzyFilterAndRank } from '../utils/fuzzySearch';
import { FuzzyHighlightText } from './FuzzyAutocomplete';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'निवडा...',
  disabled = false,
  required = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(
    () => fuzzyFilterAndRank(options, query, (o) => [o.label, o.sublabel]),
    [options, query]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const selectOption = (opt: SelectOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (filtered.length === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      if (filtered.length === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      selectOption(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="app-label">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((p) => !p)}
          className="w-full flex items-center justify-between px-3 py-2 text-left bg-white border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700 transition-colors"
        >
          <span className={`truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
        </button>
      </div>

      {open && !disabled && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="नाव किंवा कोड टाइप करा (Fuzzy)..."
              className="w-full text-sm outline-none"
              autoFocus
            />
            {query && (
              <button
                type="button"
                aria-label="शोध रिकामा करा"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-700 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto" ref={listRef}>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">कोणताही पर्याय आढळला नाही</div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectOption(opt)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'bg-teal-50 font-semibold text-teal-800'
                        : isActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-800 hover:bg-teal-50/70'
                    }`}
                  >
                    <div>
                      <FuzzyHighlightText text={opt.label} query={query} />
                    </div>
                    {opt.sublabel && (
                      <div className="text-xs text-slate-500 font-mono-tabular">
                        <FuzzyHighlightText text={opt.sublabel} query={query} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
