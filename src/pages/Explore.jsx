import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Search,
  SlidersHorizontal,
  X,
  Flame,
  Clock,
  TrendingUp,
  BookOpen,
} from "lucide-react";
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
  { label: "الأكثر إعجابًا", icon: TrendingUp, sort: "-likes_count" },
  { label: "الأكثر فصولًا", icon: BookOpen, sort: "-chapters_count" },
];

export default function Explore() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [language, setLanguage] = useState("all");
  const [sort, setSort] = useState("-views");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchBoxRef = useRef(null);

  /*
   * الاقتراحات التلقائية:
   * كلما كتب المستخدم حرفًا أو أكثر،
   * نبحث مباشرة في عناوين الروايات.
   */
  const {
    data: suggestions = [],
    isFetching: loadingSuggestions,
  } = useQuery({
    queryKey: ["explore-search-suggestions", search],
    queryFn: async () => {
      const q = search.trim();

      if (!q) return [];

      const { data, error } = await supabase
        .from("stories")
        .select("id, title, author_name")
        .eq("is_approved", true)
        .ilike("title", `%${q}%`)
        .order("title", { ascending: true })
        .limit(8);

      if (error) {
        console.error("Error fetching search suggestions:", error);
        return [];
      }

      return data || [];
    },
    enabled: search.trim().length > 0,
    staleTime: 30 * 1000,
  });

  /*
   * البحث الرئيسي:
   * يتم تشغيله عند الضغط على زر البحث أو Enter.
   */
  const {
    data: stories = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "explore-stories",
      genre,
      language,
      sort,
      statusFilter,
      submittedSearch,
    ],

    queryFn: async () => {
      let query = supabase
        .from("stories")
        .select("*")
        .eq("is_approved", true);

      /*
       * فلتر النوع
       */
      if (genre !== "all") {
        query = query.eq("genre", genre);
      }

      /*
       * فلتر اللغة
       */
      if (language !== "all") {
        query = query.eq("language", language);
      }

      /*
       * فلتر الحالة
       */
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      /*
       * البحث الحقيقي في قاعدة البيانات.
       *
       * يبحث في:
       * - عنوان الرواية
       * - اسم الكاتب
       * - الوصف
       *
       * ilike = لا يهتم بحالة الأحرف.
       */
      const q = submittedSearch.trim();

      if (q) {
        const safeQuery = q.replace(/[%(),]/g, " ").trim();

        if (safeQuery) {
          query = query.or(
            `title.ilike.%${safeQuery}%,author_name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
          );
        }
      }

      const sortColumn =
        sort === "-views"
          ? "views"
          : sort === "-created_date"
            ? "created_at"
            : sort === "-likes_count"
              ? "likes_count"
              : sort === "-chapters_count"
                ? "chapters_count"
                : "views";

      const { data, error } = await query
        .order(sortColumn, { ascending: false })
        .limit(60);

      if (error) {
        throw error;
      }

      return data || [];
    },

    /*
     * كلما تغير البحث أو النوع أو اللغة أو الحالة أو الترتيب
     * يتم تنفيذ البحث من جديد.
     */
  });

  const { containerRef, pull, refreshing } =
    usePullToRefresh(() => refetch());

  /*
   * إغلاق الاقتراحات عندما نضغط خارج صندوق البحث.
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /*
   * تنفيذ البحث.
   */
  const handleSearch = () => {
    const value = search.trim();

    setSubmittedSearch(value);
    setShowSuggestions(false);
  };

  /*
   * البحث عند الضغط على Enter.
   */
  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  /*
   * اختيار رواية من الاقتراحات.
   */
  const handleSuggestionClick = (suggestion) => {
    const title = suggestion.title || "";

    setSearch(title);
    setSubmittedSearch(title);
    setShowSuggestions(false);
  };

  /*
   * ترتيب إضافي للنتائج حتى تظهر النتائج الأكثر صلة أولًا.
   *
   * الأولوية:
   * 1. التطابق الكامل مع العنوان
   * 2. العنوان الذي يبدأ بكلمة البحث
   * 3. العنوان الذي يحتوي كلمة البحث
   * 4. اسم الكاتب
   * 5. الوصف
   */
  const filteredStories = useMemo(() => {
    const q = submittedSearch.trim().toLowerCase();

    if (!q) return stories;

    const words = q
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    const matches = stories.filter((s) => {
      const title = (s.title || "").toLowerCase();
      const author = (s.author_name || "").toLowerCase();
      const desc = (s.description || "").toLowerCase();

      const tags = Array.isArray(s.tags)
        ? s.tags.map((t) => String(t).toLowerCase())
        : [];

      const genres = [
        s.genre,
        ...(Array.isArray(s.genres) ? s.genres : []),
      ]
        .filter(Boolean)
        .map((g) => String(g).toLowerCase());

      /*
       * البحث بالكلمة كاملة أو بأي جزء منها.
       */
      const matchesAllWords = words.every((word) => {
        return (
          title.includes(word) ||
          author.includes(word) ||
          desc.includes(word) ||
          tags.some((tag) => tag.includes(word)) ||
          genres.some((g) => g.includes(word))
        );
      });

      return matchesAllWords;
    });

    const score = (s) => {
      const title = (s.title || "").toLowerCase();
      const author = (s.author_name || "").toLowerCase();
      const desc = (s.description || "").toLowerCase();

      let total = 0;

      /*
       * تطابق كامل
       */
      if (title === q) {
        total += 1000;
      }

      /*
       * العنوان يبدأ بالبحث
       */
      if (title.startsWith(q)) {
        total += 800;
      }

      /*
       * العنوان يحتوي البحث
       */
      if (title.includes(q)) {
        total += 600;
      }

      /*
       * إذا كانت كلمة البحث موجودة في بداية إحدى كلمات العنوان
       */
      const titleWords = title.split(/\s+/);

      if (
        words.some((word) =>
          titleWords.some((titleWord) =>
            titleWord.startsWith(word)
          )
        )
      ) {
        total += 500;
      }

      /*
       * اسم الكاتب
       */
      if (author.includes(q)) {
        total += 300;
      }

      /*
       * الوصف
       */
      if (desc.includes(q)) {
        total += 100;
      }

      /*
       * كل الكلمات الموجودة في العنوان
       */
      const matchedWords = words.filter((word) =>
        title.includes(word)
      ).length;

      total += matchedWords * 50;

      return total;
    };

    return [...matches].sort(
      (a, b) => score(b) - score(a)
    );
  }, [stories, submittedSearch]);

  return (
    <div
      ref={containerRef}
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8"
    >
      <PullToRefreshIndicator
        pull={pull}
        refreshing={refreshing}
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold">
          استكشف القصص
        </h1>

        <p className="text-muted-foreground mt-1 text-sm">
          اكتشف آلاف القصص من كتّاب مغاربة وعرب
        </p>
      </div>

      {/* Quick filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
        {quickFilters.map(
          ({ label, icon: Icon, sort: s }) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                sort === s
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          )
        )}
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          <div
            ref={searchBoxRef}
            className="relative flex-1"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />

            <Input
              placeholder="ابحث عن قصة أو كاتب..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggestions(
                  e.target.value.trim().length > 0
                );
              }}
              onFocus={() => {
                if (search.trim()) {
                  setShowSuggestions(true);
                }
              }}
              onKeyDown={handleSearchKeyDown}
              className="pl-10 pr-10 rounded-full"
            />

            {search && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10"
                onClick={() => {
                  setSearch("");
                  setSubmittedSearch("");
                  setShowSuggestions(false);
                }}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

            {/* Automatic search suggestions */}
            <AnimatePresence>
              {showSuggestions && search.trim() && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: -5,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -5,
                  }}
                  className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
                >
                  {loadingSuggestions ? (
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-5 w-1/2" />
                    </div>
                  ) : suggestions.length > 0 ? (
                    <div className="py-2">
                      <div className="px-4 py-2 text-xs text-muted-foreground">
                        اقتراحات الروايات
                      </div>

                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() =>
                            handleSuggestionClick(
                              suggestion
                            )
                          }
                          className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-muted transition-colors"
                        >
                          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {suggestion.title}
                            </p>

                            {suggestion.author_name && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {suggestion.author_name}
                              </p>
                            )}
                          </div>

                          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))}

                      <div className="border-t border-border mt-1 pt-2 px-4 pb-1">
                        <p className="text-xs text-muted-foreground">
                          اضغط Enter أو زر البحث لعرض جميع النتائج
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-5 text-center">
                      <Search className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />

                      <p className="text-sm font-medium">
                        لا توجد اقتراحات
                      </p>

                      <p className="text-xs text-muted-foreground mt-1">
                        اضغط Enter للبحث عن "{search}"
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Search button */}
          <Button
            type="button"
            size="icon"
            className="rounded-full flex-shrink-0"
            onClick={handleSearch}
            aria-label="بحث"
          >
            <Search className="w-4 h-4" />
          </Button>

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
              initial={{
                height: 0,
                opacity: 0,
              }}
              animate={{
                height: "auto",
                opacity: 1,
              }}
              exit={{
                height: 0,
                opacity: 0,
              }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/50 border border-border">
                <MobileSelect
                  value={language}
                  onChange={setLanguage}
                  placeholder="اللغة"
                  className="w-36"
                  options={[
                    {
                      value: "all",
                      label: "كل اللغات",
                    },
                    {
                      value: "arabic",
                      label: "العربية",
                    },
                    {
                      value: "darija",
                      label: "الدارجة",
                    },
                    {
                      value: "french",
                      label: "Français",
                    },
                    {
                      value: "english",
                      label: "English",
                    },
                  ]}
                />

                <MobileSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="الحالة"
                  className="w-36"
                  options={[
                    {
                      value: "all",
                      label: "كل الحالات",
                    },
                    {
                      value: "ongoing",
                      label: "مستمرة",
                    },
                    {
                      value: "completed",
                      label: "مكتملة",
                    },
                    {
                      value: "paused",
                      label: "متوقفة",
                    },
                  ]}
                />

                {(language !== "all" ||
                  statusFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive hover:text-destructive gap-1"
                    onClick={() => {
                      setLanguage("all");
                      setStatusFilter("all");
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                    مسح الفلاتر
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Genre suggestions / filters */}
        <GenrePicker
          selected={genre}
          onSelect={setGenre}
        />
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          {filteredStories.length} قصة{" "}
          {submittedSearch &&
            `لـ "${submittedSearch}"`}
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array(15)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="space-y-3"
              >
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

          <p className="text-xl font-heading font-semibold">
            لا توجد نتائج
          </p>

          <p className="text-muted-foreground mt-2 text-sm">
            حاول تغيير الفلاتر أو كلمة البحث
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredStories.map((story, i) => (
            <motion.div
              key={story.id}
              initial={{
                opacity: 0,
                y: 15,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: Math.min(i * 0.03, 0.3),
              }}
            >
              <StoryCard story={story} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}