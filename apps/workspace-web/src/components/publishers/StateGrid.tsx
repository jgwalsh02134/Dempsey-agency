type StateEntry = {
  state: string;
  count: number;
};

type StateGridProps = {
  states: StateEntry[];
  selectedState: string | null;
  onSelect: (state: string) => void;
};

export function StateGrid({ states, selectedState, onSelect }: StateGridProps) {
  if (states.length === 0) {
    return (
      <div className="state-grid-empty">
        <p className="muted">No states match the current filter.</p>
      </div>
    );
  }
  return (
    <div className="state-grid" role="list">
      {states.map((s) => {
        const selected = s.state === selectedState;
        return (
          <button
            key={s.state}
            type="button"
            role="listitem"
            className="state-card"
            aria-pressed={selected}
            onClick={() => onSelect(s.state)}
          >
            <span className="state-card-abbr">{s.state}</span>
            <span className="state-card-count">{s.count}</span>
          </button>
        );
      })}
    </div>
  );
}
