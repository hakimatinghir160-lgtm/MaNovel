import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Eye, Heart, BookOpen } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

const genreColors = {
  romance: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  crime: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  mafia: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  drama: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  horror: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  realistic: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  fantasy: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  other: "bg-muted text-muted-foreground"
};

export default function StoryCard({ story, variant = "default" }) {
  const { t } = useLanguage();

  const langLabels = {
    arabic: t("lang.arabic"),
    darija: t("lang.darija"),
    french: t("lang.french"),
    english: t("lang.english")
  };

  const isCompact = variant === "compact";

  const {
    data: uniqueReaders = 0
  } = useQuery({
    queryKey: ["story-reader-count", story.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_story_reader_count",
        {
          p_story_id: story.id
        }
      );

      if (error) {
        console.error("Error fetching story reader count:", error);
        return 0;
      }

      return Number(data) || 0;
    },
    enabled: Boolean(story.id),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // جلب عدد الفصول المنشورة مباشرة من جدول chapters
  const {
    data: chaptersCount = 0
  } = useQuery({
    queryKey: ["story-chapters-count", story.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("chapters")
        .select("id", { count: "exact", head: true })
        .eq("story_id", story.id)
        .eq("is_published", true);

      if (error) {
        console.error("Error fetching chapter count:", error);
        return 0;
      }

      return count || 0;
    },
    enabled: Boolean(story.id),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  return (
    <Link to={`/story/${story.id}`} className="group block">
      <div
        className={`relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 ${
          isCompact ? "flex gap-3 p-3" : ""
        }`}
      >
        {/* Cover */}
        <div
          className={`relative overflow-hidden ${
            isCompact
              ? "w-20 h-28 rounded-lg flex-shrink-0"
              : "aspect-[3/4]"
          }`}
        >
          {story.cover_image ? (
            <img
              src={story.cover_image}
              alt={story.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary/40" />
            </div>
          )}

          {!isCompact && story.status && (
            <div className="absolute top-2 left-2">
              <Badge
                variant="secondary"
                className="text-xs backdrop-blur-sm bg-background/80"
              >
                {story.status === "completed"
                  ? t("storyCard.completed")
                  : story.status === "paused"
                    ? t("storyCard.paused")
                    : t("storyCard.ongoing")}
              </Badge>
            </div>
          )}
        </div>

        {/* Info */}
        <div className={isCompact ? "flex-1 min-w-0 px-4" : ""}>
          <h3
            className={`font-heading font-semibold line-clamp-2 group-hover:text-primary transition-colors ${
              isCompact ? "text-sm" : "text-base"
            }`}
          >
            {story.title}
          </h3>

          {!isCompact && story.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">
              {story.description}
            </p>
          )}

          <p
            className={`text-muted-foreground ${
              isCompact ? "text-xs mt-0.5" : "text-sm mt-2"
            }`}
          >
            {story.author_name || t("storyCard.anonymous")}
          </p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-xs ${
                genreColors[story.genre] || genreColors.other
              }`}
            >
              {t(`genre.${story.genre}`, story.genre)}
            </Badge>

            <span className="text-xs text-muted-foreground">
              {langLabels[story.language] || story.language}
            </span>
          </div>

          {!isCompact && (
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {uniqueReaders}
              </span>

              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5" />
                {story.likes_count || 0}
              </span>

              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {chaptersCount} {t("storyCard.chapters")}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

