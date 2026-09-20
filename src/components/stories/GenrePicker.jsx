import React from "react";
import { Button } from "@/components/ui/button";
import {
  Heart, Shield, Brain, Ghost, Users, Zap, Compass, Sparkles,
  Rocket, GraduationCap, Frown, Search, Leaf, Laugh, Shuffle, LayoutGrid
} from "lucide-react";

const genres = [
  { value: "all", label: "الكل", icon: LayoutGrid },
  { value: "romance", label: "رومانسية", icon: Heart },
  { value: "drama", label: "دراما", icon: Frown },
  { value: "crime", label: "جريمة", icon: Shield },
  { value: "psychological", label: "نفسية", icon: Brain },
  { value: "horror", label: "رعب", icon: Ghost },
  { value: "mafia", label: "مافيا", icon: Users },
  { value: "action", label: "أكشن", icon: Zap },
  { value: "adventure", label: "مغامرة", icon: Compass },
  { value: "fantasy", label: "خيال", icon: Sparkles },
  { value: "sci_fi", label: "خيال علمي", icon: Rocket },
  { value: "school", label: "مدرسة", icon: GraduationCap },
  { value: "tragedy", label: "مأساة", icon: Frown },
  { value: "mystery", label: "غموض", icon: Search },
  { value: "realistic", label: "واقعي", icon: Leaf },
  { value: "comedy", label: "كوميديا", icon: Laugh },
  { value: "mixed", label: "مختلط", icon: Shuffle },
];

export default function GenrePicker({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {genres.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={selected === value ? "default" : "outline"}
          size="sm"
          className="flex-shrink-0 gap-1.5 rounded-full"
          onClick={() => onSelect(value)}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </Button>
      ))}
    </div>
  );
}