import { useEffect, useId, useRef, useState } from 'react';
import { filterSpecializations } from '@/constants/specializations';

interface SpecializationAutocompleteProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export const SpecializationAutocomplete = ({
  label,
  required,
  value,
  onChange,
  placeholder = 'Start typing a specialization…',
  error,
}: SpecializationAutocompleteProps) => {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Keep the selected specialization separate from the search query so opening the field shows all available options.
  const [isTyping, setIsTyping] = useState(false);
  const suggestions = filterSpecializations(isTyping ? value : '');

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setIsTyping(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      {label ? (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]">
            {label} {required ? <span className="text-red-500 font-bold">*</span> : null}
          </label>
          {required ? (
            <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600 border border-red-200">
              Required
            </span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Optional
            </span>
          )}
        </div>
      ) : null}
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setIsTyping(true);
          onChange(e.target.value);
          setOpen(true);
        }}
        className={[
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:border-primary',
          error ? 'border-error' : 'border-border',
        ].join(' ')}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-lg"
        >
          {suggestions.map((item) => (
            <li key={item} role="option">
              <button
                type="button"
                className="w-full px-3.5 py-2 text-left text-sm hover:bg-primary-light"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(item);
                  setIsTyping(false);
                  setOpen(false);
                }}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="text-[13px] text-error">{error}</span>}
    </div>
  );
};
