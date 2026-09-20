import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Heart, Eye, BookOpen, Bookmark, MessageCircle,
  Clock, User, ChevronRight, Send, Play, CheckCircle2, PauseCircle
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ShareStoryButton from "@/components/stories/ShareStoryButton";
import MobileDetailHeader from "@/components/layout/MobileDetailHeader";

const langLabels = {
  arabic: "العربية",
  darija: "الدارجة",
  french: "Français",
  english: "English"
};

const genreLabels = {
  romance: "رومانسية",
  drama: "دراما",
  crime: "جريمة",
  psychological: "نفسية",
  horror: "رعب",
  mafia: "مافيا",
  action: "أكشن",
  adventure: "مغامرة",
  fantasy: "خيال",
  sci_fi: "خيال علمي",
  school: "مدرسة",
  tragedy: "مأساة",
  mystery: "غموض",
  realistic: "واقعي",
  comedy: "كوميديا",
  mixed: "مختلط",
};

const reactions = ["❤️", "😭", "🔥", "😱", "😂", "😡"];

export default function StoryDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [selectedReaction, setSelectedReaction] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: story, isLoading } = useQuery({
    queryKey: ["story", id],
    queryFn: () => base44.entities.Story.filter({ id }).then(r => r[0]),
    enabled: !!id,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", id],
    queryFn: () =>
      base44.entities.Chapter.filter(
        { story_id: id, is_published: true },
        "chapter_number"
      ),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: () =>
      base44.entities.Comment.filter(
        { story_id: id },
        "-created_date",
        50
      ),
    enabled: !!id,
  });

  const { data: readProgress = [] } = useQuery({
    queryKey: ["read-progress", id, user?.email],
    queryFn: () =>
      base44.entities.ReadingProgress.filter({
        story_id: id,
        user_email: user.email,
      }),
    enabled: !!user && !!id,
  });

  const readChapterIds = new Set(
    (readProgress || []).map(r => r.chapter_id)
  );

  const { data: liked = false } = useQuery({
    queryKey: ["liked", id, user?.email],
    queryFn: async () => {
      if (!user) return false;

      const likes = await base44.entities.Like.filter({
        story_id: id,
        user_email: user.email,
      });

      return likes.length > 0;
    },
    enabled: !!user && !!id,
  });

  const { data: favorited = false } = useQuery({
    queryKey: ["favorited", id, user?.email],
    queryFn: async () => {
      if (!user) return false;

      const favs = await base44.entities.Favorite.filter({
        story_id: id,
        user_email: user.email,
      });

      return favs.length > 0;
    },
    enabled: !!user && !!id,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      if (liked) {
        const likes = await base44.entities.Like.filter({
          story_id: id,
          user_email: user.email,
        });

        if (likes[0]) {
          await base44.entities.Like.delete(likes[0].id);
        }

        await base44.entities.Story.update(id, {
          likes_count: Math.max(0, (story.likes_count || 0) - 1),
        });
      } else {
        await base44.entities.Like.create({
          story_id: id,
          user_email: user.email,
        });

        await base44.entities.Story.update(id, {
          likes_count: (story.likes_count || 0) + 1,
        });
      }
    },

    onMutate: async () => {
      if (!user) return;

      const prevLiked = queryClient.getQueryData([
        "liked",
        id,
        user.email
      ]);

      const prevStory = queryClient.getQueryData([
        "story",
        id
      ]);

      queryClient.setQueryData(
        ["liked", id, user.email],
        !liked
      );

      if (prevStory) {
        queryClient.setQueryData(
          ["story", id],
          {
            ...prevStory,
            likes_count: Math.max(
              0,
              (prevStory.likes_count || 0) +
                (liked ? -1 : 1)
            ),
          }
        );
      }

      return { prevLiked, prevStory };
    },

    onError: (_e, _vars, ctx) => {
      if (ctx?.prevLiked !== undefined) {
        queryClient.setQueryData(
          ["liked", id, user.email],
          ctx.prevLiked
        );
      }

      if (ctx?.prevStory) {
        queryClient.setQueryData(
          ["story", id],
          ctx.prevStory
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["liked", id],
      });

      queryClient.invalidateQueries({
        queryKey: ["story", id],
      });
    },
  });

  const favMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      if (favorited) {
        const favs = await base44.entities.Favorite.filter({
          story_id: id,
          user_email: user.email,
        });

        if (favs[0]) {
          await base44.entities.Favorite.delete(favs[0].id);
        }
      } else {
        await base44.entities.Favorite.create({
          story_id: id,
          user_email: user.email,
        });
      }
    },

    onMutate: async () => {
      if (!user) return;

      const prevFav = queryClient.getQueryData([
        "favorited",
        id,
        user.email
      ]);

      queryClient.setQueryData(
        ["favorited", id, user.email],
        !favorited
      );

      return { prevFav };
    },

    onError: (_e, _vars, ctx) => {
      if (ctx?.prevFav !== undefined) {
        queryClient.setQueryData(
          ["favorited", id, user.email],
          ctx.prevFav
        );
      }
    },

    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["favorited", id],
      }),
  });

  const commentMutation = useMutation({
    mutationFn: () => {
      if (!user) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      return base44.entities.Comment.create({
        story_id: id,
        content: commentText,
        author_name: user.full_name,
        author_email: user.email,
      });
    },

    onSuccess: () => {
      setCommentText("");

      queryClient.invalidateQueries({
        queryKey: ["comments", id],
      });

      toast.success("تم نشر تعليقك!");
    },
  });

  // --------------------------------------------------
  // الدخول إلى الفصل
  // الزائر -> تسجيل الدخول
  // المستخدم -> الفصل
  // --------------------------------------------------

  const handleReadChapter = (chapterId) => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    window.location.href = `/story/${id}/chapter/${chapterId}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="h-72 bg-muted animate-pulse" />

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <div className="h-8 bg-muted rounded w-2/3 animate-pulse" />
          <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-xl font-heading font-semibold">
          القصة غير موجودة
        </p>

        <Link to="/explore">
          <Button className="mt-4 rounded-full">
            تصفح القصص
          </Button>
        </Link>
      </div>
    );
  }

  const firstChapter = chapters[0];

  const statusConfig = {
    completed: {
      label: "مكتملة",
      icon: CheckCircle2,
      color: "text-emerald-500"
    },

    paused: {
      label: "موقوفة",
      icon: PauseCircle,
      color: "text-amber-500"
    },

    ongoing: {
      label: "مستمرة",
      icon: Clock,
      color: "text-blue-500"
    },
  };

  const sc =
    statusConfig[story.status] ||
    statusConfig.ongoing;

  const StatusIcon = sc.icon;

  return (
    <div className="min-h-screen pb-20 md:pb-0">

      <MobileDetailHeader
        title={story?.title}
        fallback="/explore"
        className="bg-transparent border-transparent"
      />

      {/* Hero Banner */}

      <div className="relative h-64 sm:h-80 overflow-hidden">

        {story.cover_image ? (
          <img
            src={story.cover_image}
            className="w-full h-full object-cover"
            alt=""
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-32 relative">

        {/* Story Header */}

        <div className="flex flex-col sm:flex-row gap-6">

          {/* Cover */}

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-36 sm:w-44 flex-shrink-0"
          >
            <div className="aspect-[3/4] rounded-2xl overflow-hidden border-4 border-background shadow-2xl">

              {story.cover_image ? (
                <img
                  src={story.cover_image}
                  alt={story.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-primary/30" />
                </div>
              )}

            </div>
          </motion.div>

          {/* Info */}

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex-1 pt-2"
          >

            <h1 className="font-heading text-2xl sm:text-3xl font-bold leading-tight">
              {story.title}
            </h1>

            <div className="inline-flex items-center gap-2 mt-2 text-muted-foreground">
              <User className="w-4 h-4" />

              <span className="text-sm font-medium">
                {story.author_name || "مجهول"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">

              <Badge className="rounded-full bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                {genreLabels[story.genre] || story.genre}
              </Badge>

              {(story.genres || [])
                .filter(g => g !== story.genre)
                .map(g => (
                  <Badge
                    key={g}
                    variant="outline"
                    className="rounded-full text-xs"
                  >
                    {genreLabels[g] || g}
                  </Badge>
                ))}

              <Badge
                variant="secondary"
                className="rounded-full"
              >
                {langLabels[story.language] || story.language}
              </Badge>

              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${sc.color}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {sc.label}
              </span>

              {story.is_adult && (
                <Badge className="rounded-full bg-red-500/10 text-red-600 border-red-500/20 font-bold">
                  +18
                </Badge>
              )}

            </div>

            {story.description && (
              <p className="text-muted-foreground mt-3 leading-relaxed text-sm">
                {story.description}
              </p>
            )}

            <div className="flex items-center gap-5 mt-4 text-sm text-muted-foreground">

              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {story.views || 0}
              </span>

              <span className="flex items-center gap-1.5">
                <Heart className="w-4 h-4" />
                {story.likes_count || 0}
              </span>

              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {chapters.length} فصل
              </span>

              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />
                {comments.length}
              </span>

            </div>

            <div className="flex gap-2 mt-5 flex-wrap">

              {firstChapter && (
                <Button
                  className="gap-2 rounded-full font-semibold px-5"
                  onClick={() =>
                    handleReadChapter(firstChapter.id)
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  ابدأ القراءة
                </Button>
              )}

              <Button
                variant={liked ? "default" : "outline"}
                className="gap-2 rounded-full"
                onClick={() => likeMutation.mutate()}
              >
                <Heart
                  className={`w-4 h-4 ${
                    liked ? "fill-current" : ""
                  }`}
                />

                {liked ? "أعجبني" : "إعجاب"}
              </Button>

              <Button
                variant={favorited ? "secondary" : "outline"}
                className="gap-2 rounded-full"
                onClick={() => favMutation.mutate()}
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    favorited ? "fill-current" : ""
                  }`}
                />

                {favorited ? "محفوظة" : "احفظ"}
              </Button>

              <ShareStoryButton
                storyTitle={story.title}
              />

            </div>
          </motion.div>
        </div>

        {/* Reaction bar */}

        <div className="flex items-center gap-2 mt-8 p-3 rounded-2xl bg-muted/30 border border-border">

          <span className="text-xs text-muted-foreground ml-2">
            ردّ فعلك:
          </span>

          {reactions.map((r) => (
            <button
              key={r}
              onClick={() =>
                setSelectedReaction(
                  r === selectedReaction
                    ? null
                    : r
                )
              }
              className={`text-xl transition-all hover:scale-125 ${
                selectedReaction === r
                  ? "scale-125 drop-shadow-lg"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              {r}
            </button>
          ))}

        </div>

        <Separator className="my-8" />

        {/* Chapters */}

        <div>

          <h2 className="font-heading text-xl font-bold mb-4">
            الفصول ({chapters.length})
          </h2>

          {chapters.length === 0 ? (

            <div className="text-center py-12 rounded-2xl border-2 border-dashed border-border">

              <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />

              <p className="text-muted-foreground mt-3">
                لم يُنشر أي فصل بعد
              </p>

            </div>

          ) : (

            <div className="space-y-2">

              {chapters.map((ch, i) => (

                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >

                  <div className="flex items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted/50 hover:border-primary/30 transition-all group">

                    <button
                      type="button"
                      onClick={() =>
                        handleReadChapter(ch.id)
                      }
                      className="flex items-center gap-3 flex-1 min-w-0 text-right"
                    >

                      <div className="relative w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">

                        <span className="text-xs font-bold text-primary">
                          {ch.chapter_number}
                        </span>

                        {user && (
                          <span
                            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                              readChapterIds.has(ch.id)
                                ? "bg-gray-400"
                                : "bg-green-500"
                            }`}
                          />
                        )}

                      </div>

                      <div className="min-w-0">

                        <p className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                          {ch.title}
                        </p>

                        {ch.created_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(
                              new Date(ch.created_date),
                              "d MMM yyyy"
                            )}
                          </p>
                        )}

                      </div>

                    </button>

                    <div className="flex items-center gap-2 flex-shrink-0">

                      <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        {ch.views || 0}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleReadChapter(ch.id)
                        }
                        aria-label={`قراءة ${ch.title}`}
                      >
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>

                    </div>

                  </div>

                </motion.div>

              ))}

            </div>

          )}

        </div>

        <Separator className="my-8" />

        {/* Comments */}

        <div>

          <h2 className="font-heading text-xl font-bold mb-5">
            التعليقات ({comments.length})
          </h2>

          {user ? (

            <div className="flex gap-3 mb-6">

              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">

                <span className="text-xs font-bold text-white">
                  {user.full_name?.[0]?.toUpperCase()}
                </span>

              </div>

              <div className="flex-1 space-y-2">

                <Textarea
                  placeholder="شارك رأيك في هذه القصة..."
                  value={commentText}
                  onChange={(e) =>
                    setCommentText(e.target.value)
                  }
                  className="rounded-xl resize-none"
                  rows={2}
                />

                <Button
                  size="sm"
                  className="rounded-full gap-2"
                  disabled={
                    !commentText.trim() ||
                    commentMutation.isPending
                  }
                  onClick={() =>
                    commentMutation.mutate()
                  }
                >
                  <Send className="w-3.5 h-3.5" />
                  نشر التعليق
                </Button>

              </div>

            </div>

          ) : (

            <button
              onClick={() =>
                base44.auth.redirectToLogin(
                  window.location.href
                )
              }
              className="w-full p-4 rounded-xl border-2 border-dashed border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition-colors mb-6"
            >
              سجّل دخولك لتضيف تعليقاً
            </button>

          )}

          <div className="space-y-3">

            {comments.map((c) => (

              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-muted/30 border border-border/50"
              >

                <div className="flex items-start gap-3">

                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {c.author_name?.[0]?.toUpperCase() || "?"}
                  </div>

                  <div className="flex-1">

                    <div className="flex items-center gap-2 mb-1">

                      <span className="text-sm font-semibold">
                        {c.author_name || "مجهول"}
                      </span>

                      {c.created_date && (
                        <span className="text-xs text-muted-foreground">
                          {format(
                            new Date(c.created_date),
                            "d MMM"
                          )}
                        </span>
                      )}

                    </div>

                    <p className="text-sm leading-relaxed">
                      {c.content}
                    </p>

                  </div>

                </div>

              </motion.div>

            ))}

          </div>

        </div>

      </div>

    </div>
  );
}