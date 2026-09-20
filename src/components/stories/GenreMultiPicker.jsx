import React from "react";

const ALL_GENRES = [
  { value: "romance", label: "رومانسية" },
  { value: "drama", label: "دراما" },
  { value: "crime", label: "جريمة" },
  { value: "psychological", label: "نفسية" },
  { value: "horror", label: "رعب" },
  { value: "mafia", label: "مافيا" },
  { value: "action", label: "أكشن" },
  { value: "adventure", label: "مغامرة" },
  { value: "fantasy", label: "خيال" },
  { value: "sci_fi", label: "خيال علمي" },
  { value: "school", label: "مدرسية" },
  { value: "tragedy", label: "مأساة" },
  { value: "mystery", label: "غموض" },
  { value: "realistic", label: "واقعية" },
  { value: "comedy", label: "كوميديا" },
  { value: "mixed", label: "مختلطة" },
];

export default function GenreMultiPicker({ selected = [], onChange }) {
  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_GENRES.map((g) => {
        const active = selected.includes(g.value);
        return (
          <button
            key={g.value}
            type="button"
            onClick={() => toggle(g.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        );
      })}
    </div>
  );
}