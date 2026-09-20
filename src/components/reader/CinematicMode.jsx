import React, { useState, useRef, useEffect, useCallback } from "react";
import { Film, Play, Pause, SkipForward, Settings2, X, User, ArrowDownCircle, Gauge } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { parseLines, detectCharacter, EMOTION_CONFIG } from "@/lib/cinematicHelpers";

const SPEEDS = [0.5, 1, 1.5, 2, 3];

/**
 * Cinematic Mode — text-only auto-scrolling reading experience.
 * All audio playback and TTS generation have been removed. Lines scroll
 * automatically across the screen at a user-adjustable speed.
 */
export default function CinematicMode({ content, onClose, storyId, characters = [] }) {
  const [lines] = useState(() => parseLines(content));
  const [speed, setSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLine, setCurrentLine] = useState(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const scrollContainerRef = useRef(null);
  const lineRefs = useRef({});
  const playingRef = useRef(false);
  const lineIdxRef = useRef(0);
  const timerRef = useRef(null);
  const isAutoScrollRef = useRef(false);
  const autoScrollStateRef = useRef(true);

  useEffect(() => { autoScrollStateRef.current = autoScrollEnabled; }, [autoScrollEnabled]);

  // Duration each line stays visible, scaled by speed (higher speed = shorter dwell).
  const lineDuration = useCallback((line) => {
    const len = (line?.text || "").length;
    return Math.max(2200, len * 55) / speed;
  }, [speed]);

  const doAutoScroll = useCallback((idx) => {
    if (!autoScrollStateRef.current) return;
    const el = lineRefs.current?.[idx];
    if (!el) return;
    isAutoScrollRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => { isAutoScrollRef.current = false; }, 450);
  }, []);

  // Auto-advance loop — schedules the next line after the current line's dwell.
  useEffect(() => {
    if (!isPlaying) return;
    playingRef.current = true;
    const scheduleNext = () => {
      if (!playingRef.current) return;
      const dur = lineDuration(lines[lineIdxRef.current]);
      timerRef.current = setTimeout(() => {
        if (!playingRef.current) return;
        if (lineIdxRef.current >= lines.length - 1) {
          playingRef.current = false;
          setIsPlaying(false);
          return;
        }
        const next = lineIdxRef.current + 1;
        lineIdxRef.current = next;
        setCurrentLine(next);
        doAutoScroll(next);
        scheduleNext();
      }, dur);
    };
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, speed, lines, lineDuration, doAutoScroll]);

  // Pause auto-scroll when the user scrolls manually during playback.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      if (isAutoScrollRef.current) return;
      if (playingRef.current) setAutoScrollEnabled(false);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  const toggle = useCallback(() => {
    if (playingRef.current) {
      playingRef.current = false;
      setIsPlaying(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      if (lineIdxRef.current >= lines.length - 1) {
        lineIdxRef.current = 0;
        setCurrentLine(0);
        doAutoScroll(0);
      }
      setIsPlaying(true);
    }
  }, [doAutoScroll]);

  const skip = useCallback((dir) => {
    const wasPlaying = playingRef.current;
    playingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    const next = Math.max(0, Math.min(lines.length - 1, lineIdxRef.current + dir));
    lineIdxRef.current = next;
    setCurrentLine(next);
    doAutoScroll(next);
    if (wasPlaying) {
      setTimeout(() => { playingRef.current = true; setIsPlaying(true); }, 80);
    }
  }, [lines.length, doAutoScroll]);

  const seekToLine = useCallback((idx) => {
    const wasPlaying = playingRef.current;
    playingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    lineIdxRef.current = idx;
    setCurrentLine(idx);
    doAutoScroll(idx);
    if (wasPlaying) {
      setTimeout(() => { playingRef.current = true; setIsPlaying(true); }, 80);
    }
  }, [doAutoScroll]);

  const resumeAutoScroll = useCallback(() => {
    setAutoScrollEnabled(true);
    setTimeout(() => doAutoScroll(lineIdxRef.current), 60);
  }, [doAutoScroll]);

  useEffect(() => () => {
    playingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* Top cinematic bar */}
      <div className="h-8 bg-black flex-shrink-0" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-black/90 flex-shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-medium tracking-widest uppercase text-amber-400">الوضع السينمائي</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowSettings(!showSettings)} className="text-white/40 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <Settings2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings panel — speed only */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-zinc-900/95 border-b border-white/10 flex-shrink-0"
          >
            <div className="px-5 py-4 space-y-4 max-w-lg mx-auto">
              <div className="flex items-center gap-4">
                <span className="text-xs text-white/40 w-16 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5" /> السرعة
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${speed === s ? "bg-amber-400 text-black" : "bg-white/10 text-white/50 hover:bg-white/20"}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-white/30">تتحكم السرعة في مدى بقاء كل سطر على الشاشة قبل الانتقال للتالي.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lines */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-6 px-4 sm:px-8 space-y-3">
        {lines.map((line, i) => {
          const isActive = i === currentLine;
          const isPast = i < currentLine;
          const ec = EMOTION_CONFIG[line.emotion] || EMOTION_CONFIG.neutral;
          const matchedChar = detectCharacter(line.text, characters);

          return (
            <motion.div
              key={i}
              ref={el => lineRefs.current[i] = el}
              animate={isActive ? { scale: 1.015, x: 0 } : { scale: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => seekToLine(i)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all duration-400 ${
                isActive
                  ? `${ec.bg} ring-1 ring-amber-400/30`
                  : isPast
                  ? "opacity-20 border-transparent hover:opacity-40"
                  : "opacity-50 border-white/5 hover:opacity-70 hover:border-white/10"
              }`}
            >
              {isActive && (
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${ec.dot}`} />
                  <span className={`text-[10px] font-semibold tracking-widest uppercase ${ec.color}`}>
                    {ec.label}
                  </span>
                  {matchedChar && (
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <User className="w-2.5 h-2.5" /> {matchedChar.name}
                    </span>
                  )}
                  {!matchedChar && line.isDialogue && (
                    <span className={`text-[10px] flex items-center gap-1 ${line.gender === "female" ? "text-pink-400/60" : "text-blue-400/60"}`}>
                      {line.gender === "female" ? "أنثى" : "ذكر"}
                    </span>
                  )}
                </div>
              )}
              <p
                dir="auto"
                className={`leading-relaxed font-body transition-all duration-400 ${
                  isActive ? "text-white text-base sm:text-lg" : "text-white/30 text-sm sm:text-base"
                }`}
              >
                {line.text}
              </p>
            </motion.div>
          );
        })}
        <div className="h-24" />
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 bg-black/95 border-t border-white/10 px-5 py-4 pb-safe">
        {/* Resume auto-scroll pill */}
        <AnimatePresence>
          {!autoScrollEnabled && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex justify-center mb-3"
            >
              <button
                onClick={resumeAutoScroll}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 transition-colors"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                استئناف الحركة التلقائية
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center gap-6 max-w-sm mx-auto">
          <button
            onClick={() => skip(-1)}
            className="text-white/40 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            title="السطر السابق"
          >
            <SkipForward className="w-5 h-5 rotate-180" />
          </button>

          <button
            onClick={toggle}
            className="w-14 h-14 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-black flex items-center justify-center transition-all shadow-xl shadow-amber-400/20"
            title={isPlaying ? "إيقاف مؤقت" : "تشغيل التمرير"}
          >
            {isPlaying
              ? <Pause className="w-6 h-6" />
              : <Play className="w-6 h-6 fill-current ml-0.5" />
            }
          </button>

          <button
            onClick={() => skip(1)}
            className="text-white/40 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            title="السطر التالي"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Progress + speed */}
        <div className="mt-3 max-w-sm mx-auto">
          <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400/60 rounded-full transition-all duration-300"
              style={{ width: `${((currentLine + 1) / lines.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] text-white/20">{currentLine + 1} / {lines.length}</span>
            <span className="text-[10px] text-amber-400/70 font-medium">
              {isPlaying ? "⏸ إيقاف مؤقت" : "▶ تشغيل"} · {speed}x
            </span>
            <span className="text-[10px] text-white/20">{Math.round(((currentLine + 1) / lines.length) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-8 bg-black flex-shrink-0" />
    </motion.div>
  );
}