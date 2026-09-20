import React, { useState, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Image, Video, Music, Minus, Maximize2, Minimize2, Bold, Italic, Underline, Type, Save, X, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// A block is either { type: "text", content: "" } or { type: "image"|"video"|"audio", url: "", caption: "" }
function createTextBlock(content = "") { return { id: Date.now() + Math.random(), type: "text", content }; }
function createMediaBlock(type, url, caption = "") { return { id: Date.now() + Math.random(), type, url, caption }; }

const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28];

export default function RichChapterEditor({ initialTitle = "", initialBlocks, onSave, onCancel, isSaving, storyTitle }) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState(initialBlocks || [createTextBlock()]);
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [darkWrite, setDarkWrite] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [showMediaPicker, setShowMediaPicker] = useState(null); // blockId
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRef = useRef(null);
  const pendingMediaType = useRef(null);
  const pendingBlockId = useRef(null);

  const isDark = darkWrite;
  const editorBg = isDark ? "bg-[#0a0a0a] text-[#e8e8e6]" : "bg-white text-foreground";
  const borderColor = isDark ? "border-white/10" : "border-border";
  const toolbarBg = isDark ? "bg-[#111]" : "bg-muted/30";

  const updateBlock = (id, changes) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...changes } : b));
  };

  const insertMediaAfter = (afterId, type) => {
    setShowMediaPicker(null);
    if (type === "image" || type === "video" || type === "audio") {
      pendingMediaType.current = type;
      pendingBlockId.current = afterId;
      fileInputRef.current?.click();
    }
  };

  const insertTextAfter = (afterId) => {
    const newBlock = createTextBlock();
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setShowMediaPicker(null);
    setTimeout(() => document.getElementById(`block-${newBlock.id}`)?.focus(), 50);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const afterId = pendingBlockId.current;
    const type = pendingMediaType.current;
    setUploadingId(afterId);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const mediaBlock = createMediaBlock(type, file_url);
      const textBlock = createTextBlock();
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === afterId);
        const next = [...prev];
        next.splice(idx + 1, 0, mediaBlock, textBlock);
        return next;
      });
      toast.success("تم رفع الملف!");
    } catch {
      toast.error("فشل الرفع، حاول مرة أخرى");
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  };

  const removeBlock = (id) => {
    setBlocks(prev => prev.length > 1 ? prev.filter(b => b.id !== id) : prev);
  };

  const wordCount = blocks.filter(b => b.type === "text").reduce((s, b) => s + (b.content.trim() ? b.content.trim().split(/\s+/).length : 0), 0);
  const readingTime = Math.ceil((wordCount || 1) / 200);

  const handleSave = () => {
    // Serialize blocks to content string with media markers
    const content = blocks.map(b => {
      if (b.type === "text") return b.content;
      if (b.type === "image") return `\n[IMAGE:${b.url}|${b.caption}]\n`;
      if (b.type === "video") return `\n[VIDEO:${b.url}|${b.caption}]\n`;
      if (b.type === "audio") return `\n[AUDIO:${b.url}|${b.caption}]\n`;
      return "";
    }).join("\n");
    onSave({ title, content });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${fullscreen ? "fixed inset-0 z-50" : "relative rounded-2xl overflow-hidden border"} ${editorBg} ${borderColor} flex flex-col`}
    >
      {/* Toolbar */}
      <div className={`flex items-center justify-between gap-2 px-4 py-2 border-b ${borderColor} ${toolbarBg}`}>
        <div className="flex items-center gap-1">
          <span className={`text-xs ${isDark ? "text-white/30" : "text-muted-foreground"}`}>{wordCount} كلمة • {readingTime} دقيقة</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isDark ? "bg-white/5" : "bg-muted"}`}>
            <Type className={`w-3 h-3 ${isDark ? "text-white/40" : "text-muted-foreground"}`} />
            <Select value={String(fontSize)} onValueChange={(v) => setFontSize(Number(v))}>
              <SelectTrigger className={`h-7 w-[68px] border-none bg-transparent px-1 py-0 text-xs shadow-none focus:ring-0 ${isDark ? "text-white/70" : "text-muted-foreground"}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[80px]">
                {FONT_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}px</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <button onClick={() => setDarkWrite(!darkWrite)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-muted text-muted-foreground"}`}>
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setFullscreen(!fullscreen)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-muted text-muted-foreground"}`}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className={`px-6 sm:px-10 pt-6 pb-3 ${isDark ? "bg-[#0a0a0a]" : "bg-white"}`}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان الفصل..."
          className={`w-full text-2xl font-heading font-bold bg-transparent border-none outline-none placeholder:opacity-25 ${isDark ? "text-white" : "text-foreground"}`}
          dir="auto"
        />
        <div className={`mt-4 h-px ${isDark ? "bg-white/5" : "bg-border/40"}`} />
      </div>

      {/* Blocks */}
      <div className={`flex-1 overflow-auto ${isDark ? "bg-[#0a0a0a]" : "bg-white"}`} style={{ minHeight: fullscreen ? "calc(100vh - 180px)" : "400px" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 space-y-1">
          {blocks.map((block) => (
            <div key={block.id} className="group relative">
              {block.type === "text" ? (
                <div className="relative">
                  <textarea
                    id={`block-${block.id}`}
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                    onFocus={() => setActiveBlockId(block.id)}
                    onBlur={() => setActiveBlockId(null)}
                    placeholder="اكتب هنا..."
                    className={`w-full bg-transparent border-none outline-none resize-none leading-loose placeholder:opacity-20 ${isDark ? "text-white/90" : "text-foreground"}`}
                    style={{ fontSize: `${fontSize}px`, lineHeight: "2.1", minHeight: "60px" }}
                    dir="auto"
                    rows={3}
                    onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  />
                </div>
              ) : block.type === "image" ? (
                <div className="my-4 rounded-xl overflow-hidden border border-border relative group">
                  <img src={block.url} alt={block.caption} className="w-full max-h-96 object-cover" />
                  <input
                    value={block.caption}
                    onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                    placeholder="وصف الصورة..."
                    className={`w-full text-xs px-3 py-2 border-t border-border bg-transparent outline-none ${isDark ? "text-white/50 border-white/10" : "text-muted-foreground"}`}
                    dir="auto"
                  />
                  <button onClick={() => removeBlock(block.id)} className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : block.type === "video" ? (
                <div className="my-4 rounded-xl overflow-hidden border border-border relative group">
                  <video src={block.url} controls className="w-full max-h-64" />
                  <input
                    value={block.caption}
                    onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                    placeholder="وصف الفيديو..."
                    className={`w-full text-xs px-3 py-2 border-t border-border bg-transparent outline-none ${isDark ? "text-white/50 border-white/10" : "text-muted-foreground"}`}
                    dir="auto"
                  />
                  <button onClick={() => removeBlock(block.id)} className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : block.type === "audio" ? (
                <div className={`my-4 rounded-xl p-3 border flex items-center gap-3 ${isDark ? "border-white/10 bg-white/5" : "border-border bg-muted/30"}`}>
                  <Music className="w-5 h-5 text-primary flex-shrink-0" />
                  <audio src={block.url} controls className="flex-1 h-8" />
                  <button onClick={() => removeBlock(block.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : null}

              {/* + Button after each block */}
              <div className="flex items-center gap-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className={`flex-1 h-px ${isDark ? "bg-white/5" : "bg-border/30"}`} />
                <div className="relative">
                  <button
                    onClick={() => setShowMediaPicker(showMediaPicker === block.id ? null : block.id)}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${isDark ? "border-white/20 text-white/40 hover:border-white/40 hover:text-white/70 bg-[#0a0a0a]" : "border-border text-muted-foreground hover:border-primary hover:text-primary bg-white"}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <AnimatePresence>
                    {showMediaPicker === block.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`absolute bottom-8 left-1/2 -translate-x-1/2 rounded-2xl border shadow-xl p-2 z-20 flex gap-1 ${isDark ? "bg-zinc-900 border-white/10" : "bg-card border-border"}`}
                      >
                        {[
                          { type: "text", icon: Type, label: "نص" },
                          { type: "image", icon: Image, label: "صورة" },
                          { type: "video", icon: Video, label: "فيديو" },
                          { type: "audio", icon: Music, label: "صوت" },
                        ].map(({ type, icon: Icon, label }) => (
                          <button
                            key={type}
                            onClick={() => type === "text" ? insertTextAfter(block.id) : insertMediaAfter(block.id, type)}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors text-xs ${isDark ? "hover:bg-white/10 text-white/60 hover:text-white" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className={`flex-1 h-px ${isDark ? "bg-white/5" : "bg-border/30"}`} />
              </div>

              {uploadingId === block.id && (
                <div className={`flex items-center gap-2 py-2 px-3 rounded-xl text-xs ${isDark ? "text-white/40" : "text-muted-foreground"}`}>
                  <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  جاري الرفع...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className={`flex items-center justify-between px-4 py-3 border-t ${borderColor} ${toolbarBg}`}>
        <Button variant="ghost" size="sm" className="rounded-full gap-1.5" onClick={onCancel}>
          <X className="w-3.5 h-3.5" /> إلغاء
        </Button>
        <Button size="sm" className="rounded-full gap-1.5 px-5" disabled={!title.trim() || isSaving} onClick={handleSave}>
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "جاري النشر..." : "نشر الفصل"}
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleFileUpload} />
    </motion.div>
  );
}