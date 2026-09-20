import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Sticky mobile-only header for detail/sub pages with a standard back button.
// Hidden on desktop. Preserves desktop layout untouched.
export default function MobileDetailHeader({ title, fallback = "/", className }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 h-14",
        "bg-background/90 backdrop-blur-xl border-b border-border",
        className
      )}
    >
      <button
        onClick={handleBack}
        aria-label="Back"
        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors active:scale-95"
      >
        <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
      </button>
      {title && (
        <h1 className="font-heading font-semibold text-base line-clamp-1 flex-1">{title}</h1>
      )}
    </header>
  );
}