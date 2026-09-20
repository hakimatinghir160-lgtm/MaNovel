import { useRef, useState, useCallback, useEffect } from "react";

// Simple pull-to-refresh: works on touch devices when the container is scrolled to the top.
// Usage: const { containerRef, pull, refreshing } = usePullToRefresh(async () => { await refetch(); });
const THRESHOLD = 70;
const MAX_PULL = 100;

export function usePullToRefresh(onRefresh, enabled = true) {
  const containerRef = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulling = useRef(false);

  const atTop = useCallback(() => {
    const el = containerRef.current;
    const elTop = el ? el.scrollTop <= 0 : true;
    const winTop = typeof window !== "undefined" ? window.scrollY <= 0 : true;
    return elTop && winTop;
  }, []);

  const handleTouchStart = useCallback(
    (e) => {
      if (!enabled || refreshing) return;
      if (!atTop()) return;
      startY.current = e.touches[0].clientY;
    },
    [enabled, refreshing, atTop]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (startY.current === null || refreshing) return;
      if (!atTop()) {
        startY.current = null;
        pulling.current = false;
        return;
      }
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0) {
        pulling.current = true;
        setPull(Math.min(diff * 0.5, MAX_PULL));
      }
    },
    [refreshing, atTop]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) {
      startY.current = null;
      return;
    }
    pulling.current = false;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }, [pull, refreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, pull, refreshing };
}