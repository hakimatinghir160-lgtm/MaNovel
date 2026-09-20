import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import {
  useQuery,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Heart,
  Eye,
  BookOpen,
  Bookmark,
  MessageCircle,
  Clock,
  User,
  ChevronRight,
  Send,
  Play,
  CheckCircle2,
  PauseCircle
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
  mixed: "مختلط"
};

const reactions = ["❤️", "😍", "🔥", "😱", "😂", "😡"];

export default function StoryDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, navigateToLogin } = useAuth();

  const [commentText, setCommentText] = useState("");

  const { data: story, isLoading } = useQuery({
    queryKey: ["story", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // عدد القراء الفريدين للرواية
  // نفس المستخدم لا يُحسب أكثر من مرة مهما عاد إلى الرواية
  const { data: uniqueReaders = 0 } = useQuery({
    queryKey: ["story-reader-count", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_story_reader_count",
        {
          p_story_id: id
        }
      );

      if (error) {
        console.error(
          "Error fetching story reader count:",
          error
        );
        return 0;
      }

      return Number(data) || 0;
    },
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("story_id", id)
        .eq("is_published", true)
        .order("chapter_number", {
          ascending: true
        });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  /*
   * ==========================================
   * عدد القراء الفريدين لكل فصل
   * ==========================================
   *
   * لا نستعمل ch.views هنا.
   *
   * كل فصل يأخذ عدده الحقيقي من:
   * public.chapter_readers
   *
   * نفس المستخدم لا يُحسب أكثر من مرة.
   */
  const {
    data: chapterReaderCounts = {}
  } = useQuery({
    queryKey: [
      "chapter-reader-counts",
      id,
      chapters.map((ch) => ch.id)
    ],

    queryFn: async () => {
      if (!chapters.length) {
        return {};
      }

      const counts = {};

      await Promise.all(
        chapters.map(async (ch) => {
          const {
            data,
            error
          } = await supabase.rpc(
            "get_chapter_reader_count",
            {
              p_chapter_id: ch.id
            }
          );

          if (error) {
            console.error(
              "Error fetching chapter reader count:",
              ch.id,
              error
            );

            counts[ch.id] = 0;
            return;
          }

          counts[ch.id] =
            Number(data) || 0;
        })
      );

      return counts;
    },

    enabled: chapters.length > 0,

    staleTime: 0,

    // تحديث عدد القراء تلقائياً
    refetchInterval: 3000,

    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // تعليقات الرواية فقط
  // التعليقات المرتبطة بفصل لن تظهر هنا
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("story_id", id)
        .is("chapter_id", null)
        .order("created_at", {
          ascending: false
        })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  const { data: readProgress = [] } = useQuery({
    queryKey: [
      "read-progress",
      id,
      user?.email
    ],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data, error } = await supabase
        .from("reading_progress")
        .select("*")
        .eq("story_id", id)
        .eq("user_email", user.email);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.email && !!id
  });

  const readChapterIds = new Set(
    (readProgress || []).map(
      (r) => r.chapter_id
    )
  );

  const { data: liked = false } = useQuery({
    queryKey: [
      "liked",
      id,
      user?.email
    ],
    queryFn: async () => {
      if (!user?.email) return false;

      const { data, error } = await supabase
        .from("likes")
        .select("id")
        .eq("story_id", id)
        .eq("user_email", user.email)
        .limit(1);

      if (error) throw error;

      return (data || []).length > 0;
    },
    enabled:
      !!user?.email && !!id
  });

  const { data: favorited = false } =
    useQuery({
      queryKey: [
        "favorited",
        id,
        user?.email
      ],
      queryFn: async () => {
        if (!user?.email) return false;

        const { data, error } =
          await supabase
            .from("favorites")
            .select("id")
            .eq("story_id", id)
            .eq(
              "user_email",
              user.email
            )
            .limit(1);

        if (error) throw error;

        return (data || []).length > 0;
      },
      enabled:
        !!user?.email && !!id
    });

  /*
   * ================================
   * نظام ردود الفعل على الرواية
   * ================================
   */

  // Reaction المستخدم الحالي
  const {
    data: selectedReaction = null
  } = useQuery({
    queryKey: [
      "my-story-reaction",
      id,
      user?.id
    ],
    queryFn: async () => {
      if (!user?.id || !id) {
        return null;
      }

      const { data, error } =
        await supabase.rpc(
          "get_my_story_reaction",
          {
            p_story_id: id
          }
        );

      if (error) {
        console.error(
          "Error fetching my story reaction:",
          error
        );

        return null;
      }

      return data || null;
    },
    enabled:
      !!user?.id && !!id
  });

  // أعداد الـReactions
  const {
    data: reactionCounts = {}
  } = useQuery({
    queryKey: [
      "story-reaction-counts",
      id
    ],
    queryFn: async () => {
      if (!id) return {};

      const { data, error } =
        await supabase.rpc(
          "get_story_reaction_counts",
          {
            p_story_id: id
          }
        );

      if (error) {
        console.error(
          "Error fetching story reaction counts:",
          error
        );

        return {};
      }

      const counts = {};

      reactions.forEach(
        (reaction) => {
          counts[reaction] = 0;
        }
      );

      (data || []).forEach(
        (item) => {
          counts[item.reaction] =
            Number(item.count) || 0;
        }
      );

      return counts;
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // إضافة / تغيير / إزالة Reaction
  const reactionMutation =
    useMutation({
      mutationFn: async (
        reaction
      ) => {
        if (!requireLogin()) return;

        // إذا ضغط المستخدم على نفس الـReaction
        // يتم إلغاء الـReaction
        if (
          selectedReaction ===
          reaction
        ) {
          const { error } =
            await supabase.rpc(
              "remove_story_reaction",
              {
                p_story_id: id
              }
            );

          if (error) throw error;

          return {
            type: "remove",
            reaction
          };
        }

        // إذا اختار Reaction جديد
        // يتم استبدال القديم بالجديد تلقائياً
        const { error } =
          await supabase.rpc(
            "set_story_reaction",
            {
              p_story_id: id,
              p_reaction: reaction
            }
          );

        if (error) throw error;

        return {
          type: "set",
          reaction
        };
      },

      onMutate: async (
        reaction
      ) => {
        if (!user) return;

        const reactionKey = [
          "story-reaction-counts",
          id
        ];

        const myReactionKey = [
          "my-story-reaction",
          id,
          user.id
        ];

        await queryClient.cancelQueries(
          {
            queryKey: reactionKey
          }
        );

        await queryClient.cancelQueries(
          {
            queryKey: myReactionKey
          }
        );

        const previousCounts =
          queryClient.getQueryData(
            reactionKey
          ) || {};

        const previousReaction =
          queryClient.getQueryData(
            myReactionKey
          ) ?? null;

        const newCounts = {
          ...previousCounts
        };

        reactions.forEach(
          (r) => {
            if (
              typeof newCounts[r] !==
              "number"
            ) {
              newCounts[r] = 0;
            }
          }
        );

        // الضغط على نفس Reaction = إزالة
        if (
          previousReaction ===
          reaction
        ) {
          newCounts[reaction] =
            Math.max(
              0,
              newCounts[reaction] -
                1
            );

          queryClient.setQueryData(
            myReactionKey,
            null
          );
        } else {
          // إذا كان هناك Reaction قديم
          // ننقصه أولاً
          if (previousReaction) {
            newCounts[
              previousReaction
            ] = Math.max(
              0,
              newCounts[
                previousReaction
              ] - 1
            );
          }

          // نزيد Reaction الجديد
          newCounts[reaction] =
            (newCounts[reaction] ||
              0) + 1;

          queryClient.setQueryData(
            myReactionKey,
            reaction
          );
        }

        queryClient.setQueryData(
          reactionKey,
          newCounts
        );

        return {
          previousCounts,
          previousReaction
        };
      },

      onError: (
        error,
        _reaction,
        context
      ) => {
        console.error(
          "REACTION ERROR:",
          error
        );

        if (
          context?.previousCounts
        ) {
          queryClient.setQueryData(
            [
              "story-reaction-counts",
              id
            ],
            context.previousCounts
          );
        }

        queryClient.setQueryData(
          [
            "my-story-reaction",
            id,
            user?.id
          ],
          context?.previousReaction ??
            null
        );

        toast.error(
          "حدث خطأ أثناء تسجيل رد الفعل"
        );
      },

      onSettled: () => {
        queryClient.invalidateQueries(
          {
            queryKey: [
              "story-reaction-counts",
              id
            ]
          }
        );

        queryClient.invalidateQueries(
          {
            queryKey: [
              "my-story-reaction",
              id,
              user?.id
            ]
          }
        );
      }
    });

  const requireLogin = () => {
    if (!isAuthenticated || !user) {
      navigateToLogin();
      return false;
    }

    return true;
  };

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!requireLogin()) return;

      if (liked) {
        const {
          data: likes,
          error: findError
        } = await supabase
          .from("likes")
          .select("id")
          .eq("story_id", id)
          .eq(
            "user_email",
            user.email
          )
          .limit(1);

        if (findError)
          throw findError;

        if (likes?.[0]) {
          const { error } =
            await supabase
              .from("likes")
              .delete()
              .eq(
                "id",
                likes[0].id
              );

          if (error) throw error;
        }

        const {
          error: storyError
        } = await supabase.rpc(
          "decrement_story_likes",
          {
            story_uuid: id
          }
        );

        if (storyError)
          throw storyError;
      } else {
        const { error } =
          await supabase
            .from("likes")
            .insert({
              story_id: id,
              user_email:
                user.email
            });

        if (error) throw error;

        const {
          error: storyError
        } = await supabase.rpc(
          "increment_story_likes",
          {
            story_uuid: id
          }
        );

        if (storyError)
          throw storyError;
      }
    },

    onMutate: async () => {
      if (!user) return;

      const prevLiked =
        queryClient.getQueryData([
          "liked",
          id,
          user.email
        ]);

      const prevStory =
        queryClient.getQueryData([
          "story",
          id
        ]);

      queryClient.setQueryData(
        [
          "liked",
          id,
          user.email
        ],
        !liked
      );

      if (prevStory) {
        queryClient.setQueryData(
          ["story", id],
          {
            ...prevStory,
            likes_count:
              Math.max(
                0,
                (prevStory.likes_count ||
                  0) +
                  (liked ? -1 : 1)
              )
          }
        );
      }

      return {
        prevLiked,
        prevStory
      };
    },

    onError: (
      error,
      _vars,
      ctx
    ) => {
      console.error(
        "LIKE ERROR:",
        error
      );

      if (
        ctx?.prevLiked !==
        undefined
      ) {
        queryClient.setQueryData(
          [
            "liked",
            id,
            user.email
          ],
          ctx.prevLiked
        );
      }

      if (ctx?.prevStory) {
        queryClient.setQueryData(
          ["story", id],
          ctx.prevStory
        );
      }

      toast.error(
        "حدث خطأ أثناء تسجيل الإعجاب"
      );
    },

    onSettled: () => {
      queryClient.invalidateQueries(
        {
          queryKey: [
            "liked",
            id
          ]
        }
      );

      queryClient.invalidateQueries(
        {
          queryKey: [
            "story",
            id
          ]
        }
      );
    }
  });

  const favMutation = useMutation({
    mutationFn: async () => {
      if (!requireLogin()) return;

      if (favorited) {
        const {
          data: favs,
          error: findError
        } = await supabase
          .from("favorites")
          .select("id")
          .eq("story_id", id)
          .eq(
            "user_email",
            user.email
          )
          .limit(1);

        if (findError)
          throw findError;

        if (favs?.[0]) {
          const { error } =
            await supabase
              .from("favorites")
              .delete()
              .eq(
                "id",
                favs[0].id
              );

          if (error) throw error;
        }
      } else {
        const { error } =
          await supabase
            .from("favorites")
            .insert({
              story_id: id,
              user_email:
                user.email
            });

        if (error) throw error;
      }
    },

    onMutate: async () => {
      if (!user) return;

      const prevFav =
        queryClient.getQueryData([
          "favorited",
          id,
          user.email
        ]);

      queryClient.setQueryData(
        [
          "favorited",
          id,
          user.email
        ],
        !favorited
      );

      return { prevFav };
    },

    onError: (
      error,
      _vars,
      ctx
    ) => {
      console.error(error);

      if (
        ctx?.prevFav !==
        undefined
      ) {
        queryClient.setQueryData(
          [
            "favorited",
            id,
            user.email
          ],
          ctx.prevFav
        );
      }

      toast.error(
        "حدث خطأ أثناء تحديث المحفوظات"
      );
    },

    onSettled: () => {
      queryClient.invalidateQueries(
        {
          queryKey: [
            "favorited",
            id
          ]
        }
      );
    }
  });

  // تعليق خاص بالرواية
  // chapter_id = null حتى لا يظهر داخل أي فصل
  const commentMutation =
    useMutation({
      mutationFn: async () => {
        if (!requireLogin())
          return;

        const authorName =
          user.user_metadata
            ?.full_name ||
          user.user_metadata?.name ||
          user.email?.split(
            "@"
          )[0] ||
          "مستخدم";

        const { error } =
          await supabase
            .from("comments")
            .insert({
              story_id: id,
              chapter_id: null,
              content:
                commentText.trim(),
              author_name:
                authorName,
              author_email:
                user.email
            });

        if (error) throw error;
      },

      onSuccess: () => {
        setCommentText("");

        queryClient.invalidateQueries(
          {
            queryKey: [
              "comments",
              id
            ]
          }
        );

        toast.success(
          "تم نشر تعليقك!"
        );
      },

      onError: (error) => {
        console.error(error);

        toast.error(
          "حدث خطأ أثناء نشر تعليقك"
        );
      }
    });

  const handleReadChapter = (
    chapterId
  ) => {
    if (!requireLogin()) return;

    window.location.href =
      `/story/${id}/chapter/${chapterId}`;
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

  const firstChapter =
    chapters[0];

  const statusConfig = {
    completed: {
      label: "مكتملة",
      icon: CheckCircle2,
      color:
        "text-emerald-500"
    },

    paused: {
      label: "متوقفة",
      icon: PauseCircle,
      color:
        "text-amber-500"
    },

    ongoing: {
      label: "مستمرة",
      icon: Clock,
      color:
        "text-blue-500"
    }
  };

  const sc =
    statusConfig[
      story.status
    ] ||
    statusConfig.ongoing;

  const StatusIcon =
    sc.icon;

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
            initial={{
              y: 20,
              opacity: 0
            }}
            animate={{
              y: 0,
              opacity: 1
            }}
            className="w-36 sm:w-44 flex-shrink-0"
          >
            <div className="aspect-[3/4] rounded-2xl overflow-hidden border-4 border-background shadow-2xl">

              {story.cover_image ? (
                <img
                  src={
                    story.cover_image
                  }
                  alt={
                    story.title
                  }
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
            initial={{
              y: 20,
              opacity: 0
            }}
            animate={{
              y: 0,
              opacity: 1
            }}
            transition={{
              delay: 0.1
            }}
            className="flex-1 pt-2"
          >

            <h1 className="font-heading text-2xl sm:text-3xl font-bold leading-tight">
              {story.title}
            </h1>

            <div className="inline-flex items-center gap-2 mt-2 text-muted-foreground">
              <User className="w-4 h-4" />

              <span className="text-sm font-medium">
                {story.author_name ||
                  "مجهول"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">

              <Badge className="rounded-full bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                {genreLabels[
                  story.genre
                ] ||
                  story.genre}
              </Badge>

              {(
                story.genres ||
                []
              )
                .filter(
                  (g) =>
                    g !==
                    story.genre
                )
                .map((g) => (
                  <Badge
                    key={g}
                    variant="outline"
                    className="rounded-full text-xs"
                  >
                    {genreLabels[
                      g
                    ] || g}
                  </Badge>
                ))}

              <Badge
                variant="secondary"
                className="rounded-full"
              >
                {langLabels[
                  story.language
                ] ||
                  story.language}
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
                {
                  story.description
                }
              </p>
            )}

            <div className="flex items-center gap-5 mt-4 text-sm text-muted-foreground">

              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {uniqueReaders}
              </span>

              <span className="flex items-center gap-1.5">
                <Heart className="w-4 h-4" />
                {story.likes_count ||
                  0}
              </span>

              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {
                  chapters.length
                }{" "}
                فصل
              </span>

              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />
                {
                  comments.length
                }
              </span>

            </div>

            <div className="flex gap-2 mt-5 flex-wrap">

              {firstChapter && (
                <Button
                  className="gap-2 rounded-full font-semibold px-5"
                  onClick={() =>
                    handleReadChapter(
                      firstChapter.id
                    )
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  ابدأ القراءة
                </Button>
              )}

              <Button
                variant={
                  liked
                    ? "default"
                    : "outline"
                }
                className="gap-2 rounded-full"
                onClick={() =>
                  likeMutation.mutate()
                }
              >
                <Heart
                  className={`w-4 h-4 ${
                    liked
                      ? "fill-current"
                      : ""
                  }`}
                />

                {liked
                  ? "أعجبني"
                  : "إعجاب"}
              </Button>

              <Button
                variant={
                  favorited
                    ? "secondary"
                    : "outline"
                }
                className="gap-2 rounded-full"
                onClick={() =>
                  favMutation.mutate()
                }
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    favorited
                      ? "fill-current"
                      : ""
                  }`}
                />

                {favorited
                  ? "محفوظة"
                  : "حفظ"}
              </Button>

              <ShareStoryButton
                storyTitle={
                  story.title
                }
              />

            </div>
          </motion.div>
        </div>

        {/* Reaction bar */}

        <div className="flex items-center gap-2 mt-8 p-3 rounded-2xl bg-muted/30 border border-border">

          <span className="text-xs text-muted-foreground ml-2">
            ردّ فعلك:
          </span>

          {reactions.map(
            (r) => (
              <button
                key={r}
                type="button"
                disabled={
                  reactionMutation.isPending
                }
                onClick={() => {
                  if (
                    !requireLogin()
                  )
                    return;

                  reactionMutation.mutate(
                    r
                  );
                }}
                className={`flex flex-col items-center justify-center min-w-[42px] transition-all hover:scale-110 ${
                  selectedReaction ===
                  r
                    ? "scale-110"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                <span
                  className={`text-xl transition-all ${
                    selectedReaction ===
                    r
                      ? "drop-shadow-lg"
                      : ""
                  }`}
                >
                  {r}
                </span>

                <span
                  className={`text-xs font-semibold mt-0.5 ${
                    selectedReaction ===
                    r
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {reactionCounts[
                    r
                  ] || 0}
                </span>
              </button>
            )
          )}

        </div>

        <Separator className="my-8" />

        {/* Chapters */}

        <div>

          <h2 className="font-heading text-xl font-bold mb-4">
            الفصول (
            {
              chapters.length
            }
            )
          </h2>

          {chapters.length ===
          0 ? (

            <div className="text-center py-12 rounded-2xl border-2 border-dashed border-border">

              <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />

              <p className="text-muted-foreground mt-3">
                لم يُنشر أي فصل بعد
              </p>

            </div>

          ) : (

            <div className="space-y-2">

              {chapters.map(
                (ch, i) => (

                  <motion.div
                    key={ch.id}
                    initial={{
                      opacity: 0,
                      x: -10
                    }}
                    animate={{
                      opacity: 1,
                      x: 0
                    }}
                    transition={{
                      delay:
                        i * 0.03
                    }}
                  >

                    <div className="flex items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted/50 hover:border-primary/30 transition-all group">

                      <button
                        type="button"
                        onClick={() =>
                          handleReadChapter(
                            ch.id
                          )
                        }
                        className="flex items-center gap-3 flex-1 min-w-0 text-right"
                      >

                        <div className="relative w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">

                          <span className="text-xs font-bold text-primary">
                            {
                              ch.chapter_number
                            }
                          </span>

                          {user && (
                            <span
                              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                                readChapterIds.has(
                                  ch.id
                                )
                                  ? "bg-gray-400"
                                  : "bg-green-500"
                              }`}
                            />
                          )}

                        </div>

                        <div className="min-w-0">

                          <p className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                            {
                              ch.title
                            }
                          </p>

                          {ch.created_at && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(
                                new Date(
                                  ch.created_at
                                ),
                                "d MMM yyyy"
                              )}
                            </p>
                          )}

                        </div>

                      </button>

                      <div className="flex items-center gap-2 flex-shrink-0">

                        {/*
                         * عدد القراء الفريدين للفصل
                         *
                         * مهم:
                         * لا نستخدم ch.views هنا.
                         * العدد يأتي من chapter_readers.
                         */}
                        <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" />
                          {chapterReaderCounts[
                            ch.id
                          ] ?? 0}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleReadChapter(
                              ch.id
                            )
                          }
                          aria-label={`قراءة ${ch.title}`}
                        >
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>

                      </div>

                    </div>

                  </motion.div>

                )
              )}

            </div>

          )}

        </div>

        <Separator className="my-8" />

        {/* Comments */}

        <div>

          <h2 className="font-heading text-xl font-bold mb-5">
            التعليقات (
            {
              comments.length
            }
            )
          </h2>

          {user ? (

            <div className="flex gap-3 mb-6">

              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">

                <span className="text-xs font-bold text-white">
                  {(
                    user
                      .user_metadata
                      ?.full_name ||
                    user
                      .user_metadata
                      ?.name ||
                    user.email ||
                    "U"
                  )[0]?.toUpperCase()}
                </span>

              </div>

              <div className="flex-1 space-y-2">

                <Textarea
                  placeholder="شارك رأيك في هذه القصة..."
                  value={
                    commentText
                  }
                  onChange={(e) =>
                    setCommentText(
                      e.target.value
                    )
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
                navigateToLogin()
              }
              className="w-full p-4 rounded-xl border-2 border-dashed border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition-colors mb-6"
            >
              سجّل دخولك لتضيف تعليقاً
            </button>

          )}

          <div className="space-y-3">

            {comments.map(
              (c) => (

                <motion.div
                  key={c.id}
                  initial={{
                    opacity: 0,
                    y: 10
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  className="p-4 rounded-2xl bg-muted/30 border border-border/50"
                >

                  <div className="flex items-start gap-3">

                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {c.author_name?.[0]?.toUpperCase() ||
                        "?"}
                    </div>

                    <div className="flex-1">

                      <div className="flex items-center gap-2 mb-1">

                        <span className="text-sm font-semibold">
                          {
                            c.author_name ||
                            "مجهول"
                          }
                        </span>

                        {c.created_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(
                              new Date(
                                c.created_at
                              ),
                              "d MMM"
                            )}
                          </span>
                        )}

                      </div>

                      <p className="text-sm leading-relaxed">
                        {
                          c.content
                        }
                      </p>

                    </div>

                  </div>

                </motion.div>

              )
            )}

          </div>

        </div>

      </div>

    </div>
  );
}