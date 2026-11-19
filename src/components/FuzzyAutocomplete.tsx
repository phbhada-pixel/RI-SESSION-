import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { fuzzyFilterAndRank, getFuzzyHighlightSegments } from '../utils/fuzzySearch';

export const FuzzyHighlightText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const segments = useMemo(() => getFuzzyHighlightSegments(text, query), [text, query]);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.match ? (
          <mark
            key={idx}
            className="bg-teal-100 text-teal-900 font-semibold rounded-[2px] px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};

interface FuzzyAutocompleteProps<T> {
  value: string;
  onChange: (value: string) => void;
  items: T[];
  getSearchFields: (item: T) => Array<string | undefined | null>;
  getOptionKey: (item: T) => string;
  getOptionLabel: (item: T) => string;
  getOptionSublabel?: (item: T) => string | undefined;
  getOptionMeta?: (item: T) => string | undefined;
  getSelectValue?: (item: T) => string;
  onSelectItem?: (item: T) => void;
  placeholder?: string;
  label?: string;
  maxSuggestions?: number;
  className?: string;
  inputClassName?: string;
  emptyMessage?: string;
}

export function FuzzyAutocomplete<T>({
  value,
  onChange,
  items,
  getSearchFields,
  getOptionKey,
  getOptionLabel,
  getOptionSublabel,
  getOptionMeta,
  getSelectValue,
  onSelectItem,
  placeholder = 'शोधा...',
  label,
  maxSuggestions = 8,
  className = '',
  inputClassName = '',
  emptyMessage = 'जुळणारे परिणाम आढळले नाहीत',
}: FuzzyAutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const suggestions = useMemo(() => {
    const ranked = fuzzyFilterAndRank(items, value, getSearchFields);
    return ranked.slice(0, maxSuggestions);
  }, [items, value, getSearchFields, maxSuggestions]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  const handleSelect = (item: T) => {
    if (onSelectItem) {
      onSelectItem(item);
    } else {
      const nextValue = getSelectValue ? getSelectValue(item) : getOptionLabel(item);
      onChange(nextValue);
    }
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const shouldShowDropdown = open && (value.trim().length > 0 || suggestions.length > 0);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="app-label">{label}</label>}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        <input
          type="text"
          role="combobox"
          aria-expanded={shouldShowDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`app-input pl-9 ${value ? 'pr-8' : ''} ${inputClassName}`}
        />
        {value && (
          <button
            type="button"
            aria-label="शोध रिकामा करा"
            onClick={() => {
              onChange('');
              setActiveIndex(-1);
              setOpen(true);
            }}
            className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {shouldShowDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
        >
          {suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-500">{emptyMessage}</div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {suggestions.map((item, idx) => {
                const key = getOptionKey(item);
                const optLabel = getOptionLabel(item);
                const sublabel = getOptionSublabel?.(item);
                const meta = getOptionMeta?.(item);
                const isActive = idx === activeIndex;

                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-start justify-between gap-2 ${
                      isActive ? 'bg-teal-50 text-teal-900' : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        <FuzzyHighlightText text={optLabel} query={value} />
                      </div>
                      {sublabel && (
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          <FuzzyHighlightText text={sublabel} query={value} />
                        </div>
                      )}
                    </div>
                    {meta && (
                      <div className="text-[11px] font-mono-tabular font-semibold text-teal-800 whitespace-nowrap shrink-0 mt-0.5">
                        <FuzzyHighlightText text={meta} query={value} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
