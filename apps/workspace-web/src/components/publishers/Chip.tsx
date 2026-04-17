type ChipProps = {
  label: string;
  onRemove: () => void;
  ariaLabel?: string;
};

export function Chip({ label, onRemove, ariaLabel }: ChipProps) {
  return (
    <span className="filter-chip" role="listitem">
      <span className="filter-chip-label">{label}</span>
      <button
        type="button"
        className="filter-chip-remove"
        onClick={onRemove}
        aria-label={ariaLabel ?? `Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}
