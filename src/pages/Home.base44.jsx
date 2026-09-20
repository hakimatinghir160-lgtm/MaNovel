import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/common/PullToRefreshIndicator";
import { saveHomeCache, getHomeCache } from "@/lib/homeCache";
import { WifiOff } from "lucide-react";
import HeroSection from "../components/home/HeroSection";
import TrendingSection from "../components/home/TrendingSection";

export default function Home() {
  const [cacheMode, setCacheMode] = useState(false);

  // Fetch a section, persist it locally on success, and fall back to the
  // cached copy when the server is unreachable.
  const fetchWithCache = useCallback(async (key, filterFn) => {
    try {
      const data = await filterFn();
      saveHomeCache(key, data);
      return data;
    } catch (e) {
      const cached = getHomeCache(key);
      if (cached) {
        setCacheMode(true);
        return cached;
      }
      throw e;
    }
  }, []);

  const { data: trendingStories = [], isLoading: loadingTrending, refetch: refetchTrending } = useQuery({
    queryKey: ["trending-stories"],
    queryFn: () => fetchWithCache("trending", () => base44.entities.Story.filter({ is_approved: true }, "-views", 12)),
  });

  const refreshAll = async () => {
    setCacheMode(false);
    await refetchTrending();
  };
  const { containerRef, pull, refreshing } = usePullToRefresh(refreshAll);

  return (
    <div ref={containerRef}>
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} />
      {cacheMode && (
        <div className="max-w-5xl mx-auto px-4 mt-3">
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>تعذّر الاتصال بالخادم — تُعرض آخر البيانات المحفوظة على جهازك.</span>
          </div>
        </div>
      )}
      <HeroSection />
      <TrendingSection stories={trendingStories} isLoading={loadingTrending} />
    </div>
  );
}