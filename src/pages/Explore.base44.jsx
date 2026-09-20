import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, X, Flame, Clock, TrendingUp, BookOpen, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StoryCard from "../components/stories/StoryCard";
import GenrePicker from "../components/stories/GenrePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import MobileSelect from "@/components/ui/MobileSelect";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/common/PullToRefreshIndicator";

const quickFilters = [
  { label: "الأشهر", icon: Flame, sort: "-views" },
  { label: "الأحدث", icon: Clock, sort: "-created_date" },
  { label: "الأكثر إعجاباً", icon: TrendingUp, sort: "-likes_count" },
  { label: "الأكثر فصولاً", icon: BookOpen, sort: "-chapters_count" },
];

export default function Explore() {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [language, setLanguage] = useState("all");
  const [sort, setSort] = useState("-views");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: stories = [], isLoading, refetch } = useQuery({
    queryKey: ["explore-stories", genre, language, sort, statusFilter],
    queryFn: () => {
      const filter = { is_approved: true };
      if (genre !== "all") filter.genre = genre;
      if (language !== "all") filter.language = language;
      if (statusFilter !== "all") filter.status = statusFilter;
      return base44.entities.Story.filter(filter, sort, 60);
    },
  });

  const { containerRef, pull, refreshing } = usePullToRefresh(() => refetch());

  // Dynamic keyword + exact/similar title matching with relevance ranking.
  // Matches title, author, description, tags, and genre(s); exact title hits
  // are ranked first, then title-starts-with, title-contains, author, etc.
  const filteredStories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stories;
    const matches = stories.filter((s) => {
      const title = (s.title || "").toLowerCase();
      const author = (s.author_name || "").toLowerCase();
      const desc = (s.description || "").toLowerCase();
      const tags = (s.tags || []).map((t) => String(t).toLowerCase());
      const genres = [s.genre, ...(s.genres || [])].map((g) => String(g).toLowerCase());
      return title.includes(q) || author.includes(q) || desc.includes(q) ||
        tags.some((t) => t.includes(q)) || genres.some((g) => g.includes(q));
    });
    const score = (s) => {
      const title = (s.title || "").toLowerCase();
      if (title === q) return 100;
      if (title.startsWith(q)) return 80;
      if (title.includes(q)) return 60;
      if ((s.author_name || "").toLowerCase().includes(q)) return 40;
      if ((s.description || "").toLowerCase().includes(q)) return 20;
      return 10; // tags / genre keyword match
    };
    return [...matches].sort((a, b) => score(b) - score(a));
  }, [stories, search]);

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} />
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold">استكشف القصص</h1>
        <p className="text-muted-foreground mt-1 text-sm">اكتشف آلاف القصص من كتّاب مغاربة وعرب</p>
      </div>

      {/* Quick filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
        {quickFilters.map(({ label, icon: Icon, sort: s }) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${sort === s ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن قصة أو كاتب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-full"
            />
            {search && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            className="rounded-full flex-shrink-0"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/50 border border-border">
                <MobileSelect
                  value={language}
                  onChange={setLanguage}
                  placeholder="اللغة"
                  className="w-36"
                  options={[
                    { value: "all", label: "كل اللغات" },
                    { value: "arabic", label: "العربية" },
                    { value: "darija", label: "الدارجة" },
                    { value: "french", label: "Français" },
                    { value: "english", label: "English" },
                  ]}
                />

                <MobileSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="الحالة"
                  className="w-36"
                  options={[
                    { value: "all", label: "كل الحالات" },
                    { value: "ongoing", label: "مستمرة" },
                    { value: "completed", label: "مكتملة" },
                    { value: "paused", label: "موقوفة" },
                  ]}
                />

                {(language !== "all" || statusFilter !== "all") && (
                  <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive gap-1" onClick={() => { setLanguage("all"); setStatusFilter("all"); }}>
                    <X className="w-3.5 h-3.5" /> مسح الفلاتر
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <GenrePicker selected={genre} onSelect={setGenre} />
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          {filteredStories.length} قصة {search && `لـ "${search}"`}
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array(15).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-xl font-heading font-semibold">لا توجد نتائج</p>
          <p className="text-muted-foreground mt-2 text-sm">حاول تغيير الفلاتر أو كلمة البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredStories.map((story, i) => (
            <motion.div key={story.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <StoryCard story={story} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}