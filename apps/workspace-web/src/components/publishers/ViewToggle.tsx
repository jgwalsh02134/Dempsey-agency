import { useRef, type KeyboardEvent } from "react";

export type View = "map" | "dma" | "state";

type ViewToggleProps = {
  value: View;
  onChange: (next: View) => void;
};

const OPTIONS: Array<{ value: View; label: string }> = [
  { value: "map", label: "Map" },
  { value: "dma", label: "DMA" },
  { value: "state", label: "State" },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const focusIndex = (idx: number) => {
    const clamped = ((idx % OPTIONS.length) + OPTIONS.length) % OPTIONS.length;
    const el = buttonsRef.current[clamped];
    if (el) el.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = OPTIONS.findIndex((o) => o.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (current + 1) % OPTIONS.length;
      onChange(OPTIONS[next].value);
      focusIndex(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (current - 1 + OPTIONS.length) % OPTIONS.length;
      onChange(OPTIONS[prev].value);
      focusIndex(prev);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(OPTIONS[0].value);
      focusIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(OPTIONS[OPTIONS.length - 1].value);
      focusIndex(OPTIONS.length - 1);
    }
  };

  return (
    <div
      className="view-toggle"
      role="radiogroup"
      aria-label="Publishers view"
      onKeyDown={onKey}
    >
      {OPTIONS.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="view-toggle-chip"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
