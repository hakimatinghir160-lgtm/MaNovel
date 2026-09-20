import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown } from "lucide-react";

// A select that renders as a Vaul bottom-sheet drawer on mobile and a regular
// dropdown on desktop. Props match the subset of shadcn Select we use.
export default function MobileSelect({ value, onChange, placeholder, options = [], className }) {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder || "";

  return (
    <>
      {/* Desktop: native shadcn Select */}
      <div className="hidden md:block">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={className}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: Vaul drawer bottom sheet */}
      <div className="md:hidden">
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between rounded-full text-sm font-normal"
            >
              <span className={value ? "" : "text-muted-foreground"}>{selectedLabel}</span>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[70vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-center">{placeholder}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-3 pb-safe pb-4 max-h-[55vh]">
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm transition-colors mb-1 ${
                      active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    }`}
                  >
                    <span>{o.label}</span>
                    {active && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}