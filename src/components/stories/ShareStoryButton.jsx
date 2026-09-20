import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Twitter, Facebook, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function ShareStoryButton({ storyTitle }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = window.location.href;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(storyTitle || "");

  const share = (platform) => {
    const links = {
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    };
    window.open(links[platform], "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("تم نسخ الرابط!");
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => setOpen(!open)}
      >
        <Share2 className="w-4 h-4" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-20 bg-card border border-border rounded-2xl shadow-xl p-3 w-52 space-y-1">
            <p className="text-xs text-muted-foreground px-2 pb-1">مشاركة القصة</p>
            <button
              onClick={() => share("whatsapp")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium"
            >
              <MessageCircle className="w-4 h-4 text-green-500" /> واتساب
            </button>
            <button
              onClick={() => share("twitter")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium"
            >
              <Twitter className="w-4 h-4 text-sky-500" /> تويتر / X
            </button>
            <button
              onClick={() => share("facebook")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium"
            >
              <Facebook className="w-4 h-4 text-blue-600" /> فيسبوك
            </button>
            <button
              onClick={copy}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              {copied ? "تم النسخ!" : "نسخ الرابط"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}