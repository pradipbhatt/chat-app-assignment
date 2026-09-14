import { useEffect, useState } from 'react';
import { tripleToHex, hexToTriple } from '../lib/themes.js';

const HEX = /^#?[0-9a-fA-F]{6}$/;

export function ColorField({ label, value, onChange }) {
  const hex = tripleToHex(value);
  const [draft, setDraft] = useState(hex);

  useEffect(() => {
    setDraft(hex);
  }, [hex]);

  const commit = (next) => {
    setDraft(next);
    if (!HEX.test(next)) return;
    onChange(hexToTriple(next.startsWith('#') ? next : `#${next}`));
  };

  return (
    <div className="flex items-center gap-2.5 rounded-clay bg-elevated py-2 pl-2 pr-2.5 shadow-clay-in">
      <span className="relative h-8 w-8 shrink-0 rounded-full shadow-swatch">
        <input
          type="color"
          aria-label={label}
          value={hex}
          onChange={(event) => onChange(hexToTriple(event.target.value))}
          className="h-8 w-8 rounded-full"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold leading-tight">{label}</span>
        <input
          aria-label={`${label} hex value`}
          value={draft}
          spellCheck="false"
          maxLength={7}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => setDraft(hex)}
          className={`w-full bg-transparent font-mono text-[11px] uppercase leading-tight outline-none ${
            HEX.test(draft) ? 'text-fg-muted' : 'text-danger'
          }`}
        />
      </span>
    </div>
  );
}
