import type { ChangeEvent } from "react";

type SearchBarProps = {
  value: string;
  onChange: (next: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  const onInput = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value);
  return (
    <input
      type="search"
      className="publishers-search"
      placeholder="Search publishers, cities, ZIP, or DMA"
      aria-label="Search publishers"
      value={value}
      onChange={onInput}
    />
  );
}
