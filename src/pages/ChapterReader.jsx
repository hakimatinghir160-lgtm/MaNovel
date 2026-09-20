import React, { useEffect, useState, useRef } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/lib/supabaseClient";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import {
  ChevronLeft,
  ChevronRight,
  List,
  ArrowLeft,
  Sun,
  Moon,
  BookOpen,
  Type,
  MessageCircle,
  Send,
  Film,
  Eye,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";

import CinematicMode from "@/components/reader/CinematicMode";
import { useAuth } from "@/lib/AuthContext";

const readingThemes = {
  light: {
    bg: "bg-[#fafaf8]",
    text: "text-[#1a1a1a]",
    name: "فاتح",
    icon: Sun,
  },
  dark: {
    bg: "bg-[#0f0f0f]",
    text: "text-[#e8e8e8]",
    name: "داكن",
    icon: Moon,
  },
  sepia: {
    bg: "bg-[#f4ede4]",
    text: "text-[#3b2a1a]",
    name: "بيجي",
    icon: BookOpen,
  },
};

export default function ChapterReader() {
  const { storyId, chapterId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    user: authUser,
    isAuthenticated,
    isLoadingAuth,
    navigateToLogin,
  } = useAuth();

  const [fontSize, setFontSize] = useState(18);
  const [theme, setTheme] = useState("light");
  const [direction, setDirection] = useState(1);
  const [isFlipping, setIsFlipping] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [cinemaMode, setCinemaMode] = useState(false);

  const articleRef = useRef(null);
  const touchStartX = useRef(null);
  const controlsTimer = useRef(null);
  const navigationTimer = useRef(null);

  const user = authUser;

  /*
   * =========================================================
   * التحقق من تسجيل الدخول
   * =========================================================
   */

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigateToLogin(window.location.href);
    }
  }, [
    isLoadingAuth,
    isAuthenticated,
    navigateToLogin,
  ]);

  const t = readingThemes[theme];

  /*
   * =========================================================
   * جلب الفصل
   * =========================================================
   */

  const { data: chapter } = useQuery({
    queryKey: ["chapter", chapterId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("id", chapterId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },

    enabled: !!chapterId && !!user,
  });

  /*
   * =========================================================
   * جلب الرواية
   * =========================================================
   */

  const { data: story } = useQuery({
    queryKey: ["story", storyId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .eq("id", storyId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },

    enabled: !!storyId && !!user,
  });

  /*
   * =========================================================
   * جلب جميع الفصول المنشورة
   * =========================================================
   */

  const { data: allChapters = [] } = useQuery({
    queryKey: ["story-chapters", storyId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("story_id", storyId)
        .eq("is_published", true)
        .order("chapter_number", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return data || [];
    },

    enabled: !!storyId && !!user,
  });

  /*
   * =========================================================
   * جلب الشخصيات الصوتية للرواية
   * =========================================================
   */

  const { data: storyCharacters = [] } = useQuery({
    queryKey: ["voice-characters-story", storyId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_characters")
        .select("*")
        .eq("story_id", storyId);

      if (error) {
        throw error;
      }

      return data || [];
    },

    enabled: !!storyId && !!user,
  });

  /*
   * =========================================================
   * تسجيل قارئ الرواية
   * =========================================================
   */

  useEffect(() => {
    if (!storyId || !user?.id) {
      return;
    }

    const registerStoryReader = async () => {
      const { error } = await supabase.rpc(
        "register_story_reader",
        {
          p_story_id: storyId,
        }
      );

      if (error) {
        console.error(
          "Error registering story reader:",
          error
        );
      }
    };

    registerStoryReader();
  }, [storyId, user?.id]);

  /*
   * =========================================================
   * تسجيل قارئ الفصل
   *
   * كل مستخدم يُسجل مرة واحدة فقط لكل فصل.
   *
   * إذا دخل نفس المستخدم مرة أخرى:
   * لا تتم إضافة مشاهدة جديدة.
   *
   * بعد نجاح التسجيل يتم تحديث العدد مباشرة.
   * =========================================================
   */

  useEffect(() => {
    if (!chapterId || !user?.id) {
      return;
    }

    let cancelled = false;

    const registerChapterReader = async () => {
      console.log(
        "👤 REGISTERING USER:",
        user.id
      );

      console.log(
        "📖 REGISTERING CHAPTER:",
        chapterId
      );

      const {
        data,
        error,
      } = await supabase.rpc(
        "register_chapter_reader",
        {
          p_chapter_id: chapterId,
        }
      );

      console.log(
        "🔥 REGISTER CHAPTER RESULT:",
        data
      );

      if (error) {
        console.error(
          "❌ ERROR REGISTERING CHAPTER READER:",
          error
        );
        return;
      }

      console.log(
        "✅ CHAPTER READER REGISTERED:",
        user.id
      );

      if (cancelled) {
        return;
      }

      /*
       * إعادة جلب العدد بعد تسجيل المستخدم.
       * هذا مهم حتى يظهر المستخدم الثاني مباشرة.
       */

      await queryClient.invalidateQueries({
        queryKey: [
          "chapter-reader-count",
          chapterId,
        ],
      });

      await queryClient.refetchQueries({
        queryKey: [
          "chapter-reader-count",
          chapterId,
        ],
      });

      console.log(
        "🔄 CHAPTER READER COUNT REFRESHED"
      );
    };

    registerChapterReader();

    return () => {
      cancelled = true;
    };
  }, [
    chapterId,
    user?.id,
    queryClient,
  ]);

  /*
   * =========================================================
   * عدد قراء الفصل
   *
   * العدد = عدد المستخدمين المختلفين الذين
   * فتحوا هذا الفصل.
   * =========================================================
   */

  const {
    data: chapterReaderCount,
    isLoading: isChapterReaderCountLoading,
    isFetching: isChapterReaderCountFetching,
  } = useQuery({
    queryKey: [
      "chapter-reader-count",
      chapterId,
    ],

    queryFn: async () => {
      if (!chapterId || !user?.id) {
        return 0;
      }

      const {
        data: countData,
        error: countError,
      } = await supabase.rpc(
        "get_chapter_reader_count",
        {
          p_chapter_id: chapterId,
        }
      );

      if (countError) {
        console.error(
          "❌ Error getting chapter reader count:",
          countError
        );

        return 0;
      }

      const realCount =
        Number(countData) || 0;

      console.log(
        "🔥 REAL CHAPTER COUNT:",
        realCount
      );

      console.log(
        "🔥 RAW COUNT DATA:",
        countData
      );

      console.log(
        "🔥 CHAPTER ID:",
        chapterId
      );

      return realCount;
    },

    enabled:
      !!chapterId &&
      !!user?.id,

    staleTime: 0,

    /*
     * يبقى التحديث كل 3 ثوانٍ حتى إذا
     * كان هناك مستخدم آخر داخل نفس الفصل
     * يظهر العدد الجديد تلقائياً.
     */
    refetchInterval: 3000,

    refetchOnMount: true,

    refetchOnWindowFocus: true,
  });

  /*
   * =========================================================
   * القيمة المعروضة
   * =========================================================
   */

  console.log(
    "🟢 DISPLAYED CHAPTER READER COUNT:",
    chapterReaderCount
  );

  const displayedChapterReaderCount =
    chapterReaderCount == null
      ? "…"
      : Number(
          chapterReaderCount
        ).toLocaleString();

  /*
   * =========================================================
   * Mark chapter as read
   * =========================================================
   */

  useEffect(() => {
    if (
      !chapter ||
      !user ||
      !chapterId ||
      !storyId
    ) {
      return;
    }

    const markRead = async () => {
      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from("reading_progress")
        .select("id, is_read")
        .eq("chapter_id", chapterId)
        .eq("user_email", user.email)
        .limit(1);

      if (existingError) {
        throw existingError;
      }

      if (
        existing &&
        existing.length > 0
      ) {
        const existingProgress =
          existing[0];

        if (!existingProgress.is_read) {
          const {
            error: updateError,
          } = await supabase
            .from("reading_progress")
            .update({
              is_read: true,
            })
            .eq(
              "id",
              existingProgress.id
            )
            .eq(
              "user_email",
              user.email
            );

          if (updateError) {
            throw updateError;
          }
        }
      } else {
        const {
          error: insertError,
        } = await supabase
          .from("reading_progress")
          .insert({
            chapter_id: chapterId,
            story_id: storyId,
            user_email: user.email,
            is_read: true,
          });

        if (insertError) {
          throw insertError;
        }
      }

      await queryClient.invalidateQueries({
        queryKey: ["read-progress"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["story", storyId],
      });

      await queryClient.invalidateQueries({
        queryKey: [
          "story-chapters",
          storyId,
        ],
      });
    };

    markRead().catch((error) => {
      console.error(
        "Error marking chapter as read:",
        error
      );
    });
  }, [
    chapterId,
    user?.id,
    chapter,
    storyId,
    queryClient,
  ]);

  /*
   * =========================================================
   * Reading progress
   * =========================================================
   */

  useEffect(() => {
    const el = articleRef.current;

    if (!el) {
      return;
    }

    el.scrollTop = 0;
    setReadProgress(0);

    const onScroll = () => {
      const {
        scrollTop,
        scrollHeight,
        clientHeight,
      } = el;

      const progress =
        scrollHeight > clientHeight
          ? (scrollTop /
              (scrollHeight -
                clientHeight)) *
            100
          : 100;

      setReadProgress(
        Math.min(
          100,
          Math.round(progress)
        )
      );
    };

    onScroll();

    el.addEventListener(
      "scroll",
      onScroll
    );

    return () => {
      el.removeEventListener(
        "scroll",
        onScroll
      );
    };
  }, [chapterId]);

  /*
   * =========================================================
   * عند الانتقال لفصل جديد
   * =========================================================
   */

  useEffect(() => {
    setIsFlipping(false);

    if (navigationTimer.current) {
      clearTimeout(
        navigationTimer.current
      );

      navigationTimer.current = null;
    }
  }, [chapterId]);

  /*
   * =========================================================
   * إظهار / إخفاء أزرار التحكم
   * =========================================================
   */

  const resetControlsTimer = () => {
    setShowControls(true);

    clearTimeout(
      controlsTimer.current
    );

    controlsTimer.current =
      setTimeout(() => {
        setShowControls(false);
      }, 4000);
  };

  useEffect(() => {
    return () => {
      clearTimeout(
        controlsTimer.current
      );

      clearTimeout(
        navigationTimer.current
      );
    };
  }, []);

  /*
   * =========================================================
   * Chapter navigation
   * =========================================================
   */

  const currentIndex =
    allChapters.findIndex(
      (c) =>
        String(c.id) ===
        String(chapterId)
    );

  const prevChapter =
    currentIndex > 0
      ? allChapters[
          currentIndex - 1
        ]
      : null;

  const nextChapter =
    currentIndex >= 0 &&
    currentIndex <
      allChapters.length - 1
      ? allChapters[
          currentIndex + 1
        ]
      : null;

  const goToChapter = (
    ch,
    dir
  ) => {
    if (!ch || isFlipping) {
      return;
    }

    setDirection(dir);
    setIsFlipping(true);

    if (navigationTimer.current) {
      clearTimeout(
        navigationTimer.current
      );
    }

    navigationTimer.current =
      setTimeout(() => {
        navigate(
          `/story/${storyId}/chapter/${ch.id}`
        );

        setIsFlipping(false);

        navigationTimer.current =
          null;
      }, 350);
  };

  /*
   * =========================================================
   * Swipe navigation
   * =========================================================
   */

  const handleTouchStart = (e) => {
    touchStartX.current =
      e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (
      touchStartX.current === null
    ) {
      return;
    }

    const diff =
      touchStartX.current -
      e.changedTouches[0].clientX;

    if (Math.abs(diff) > 60) {
      if (
        diff > 0 &&
        nextChapter
      ) {
        goToChapter(
          nextChapter,
          1
        );
      } else if (
        diff < 0 &&
        prevChapter
      ) {
        goToChapter(
          prevChapter,
          -1
        );
      }
    }

    touchStartX.current = null;
  };

  const pageVariants = {
    enter: (dir) => ({
      x:
        dir > 0
          ? "60%"
          : "-60%",
      opacity: 0,
    }),

    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.35,
        ease: "easeOut",
      },
    },

    exit: (dir) => ({
      x:
        dir > 0
          ? "-60%"
          : "60%",
      opacity: 0,
      transition: {
        duration: 0.35,
        ease: "easeIn",
      },
    }),
  };

  /*
   * =========================================================
   * Chapter comments
   * =========================================================
   */

  const {
    data: chapterComments = [],
  } = useQuery({
    queryKey: [
      "chapter-comments",
      chapterId,
    ],

    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from("comments")
        .select("*")
        .eq(
          "chapter_id",
          chapterId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(50);

      if (error) {
        throw error;
      }

      return data || [];
    },

    enabled:
      !!chapterId &&
      !!user,
  });

  /*
   * =========================================================
   * Comment mutation
   * =========================================================
   */

  const commentMutation =
    useMutation({
      mutationFn: async () => {
        const {
          data,
          error,
        } = await supabase
          .from("comments")
          .insert({
            story_id: storyId,
            chapter_id:
              chapterId,
            content:
              commentText.trim(),
            author_name:
              user?.user_metadata
                ?.full_name ||
              user?.user_metadata
                ?.name ||
              user?.email?.split(
                "@"
              )[0] ||
              "مستخدم",
            author_email:
              user.email,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      },

      onSuccess: () => {
        setCommentText("");

        queryClient.invalidateQueries({
          queryKey: [
            "chapter-comments",
            chapterId,
          ],
        });

        toast.success(
          "تم نشر تعليقك!"
        );
      },

      onError: () => {
        toast.error(
          "تعذر نشر التعليق، حاول مرة أخرى."
        );
      },
    });

  /*
   * =========================================================
   * Word count
   * =========================================================
   */

  const wordCount =
    chapter?.content
      ?.split(/\s+/)
      .filter(Boolean)
      .length || 0;

  const readingTime =
    Math.ceil(
      wordCount / 200
    );

  /*
   * =========================================================
   * Authentication loading
   * =========================================================
   */

  if (isLoadingAuth) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${t.bg}`}
      >
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  /*
   * =========================================================
   * Chapter loading
   * =========================================================
   */

  if (!chapter) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${t.bg}`}
      >
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {cinemaMode && (
          <CinematicMode
            content={chapter.content}
            theme={theme}
            onClose={() =>
              setCinemaMode(false)
            }
            storyId={storyId}
            characters={
              storyCharacters
            }
          />
        )}
      </AnimatePresence>

      <div
        className={`min-h-screen flex flex-col ${t.bg} ${t.text} transition-colors duration-300`}
        onTouchStart={
          handleTouchStart
        }
        onTouchEnd={
          handleTouchEnd
        }
        onClick={
          resetControlsTimer
        }
      >
        {/* Progress bar */}

        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-black/10">
          <motion.div
            className="h-full bg-primary"
            animate={{
              width: `${readProgress}%`,
            }}
            transition={{
              duration: 0.1,
            }}
          />
        </div>

        {/* Top bar */}

        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{
                y: -60,
              }}
              animate={{
                y: 0,
              }}
              exit={{
                y: -60,
              }}
              transition={{
                duration: 0.2,
              }}
              className="fixed top-0.5 left-0 right-0 z-40 bg-background/95 backdrop-blur border-b border-border"
            >
              <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                <Link
                  to={`/story/${storyId}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-full"
                  >
                    <ArrowLeft className="w-4 h-4" />

                    <span className="hidden sm:inline text-sm">
                      {story?.title ||
                        "العودة"}
                    </span>
                  </Button>
                </Link>

                <div className="text-center">
                  <p className="text-xs font-medium line-clamp-1">
                    {chapter.title}
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    {currentIndex >=
                    0
                      ? currentIndex +
                        1
                      : 1}{" "}
                    /{" "}
                    {
                      allChapters.length
                    }
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      setCinemaMode(
                        true
                      );
                    }}
                    title="الوضع السينمائي"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-400/10 hover:bg-amber-400/20 text-amber-600 text-xs font-medium transition-colors"
                  >
                    <Film className="w-3.5 h-3.5" />

                    سينمائي
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();

                      setShowSettings(
                        !showSettings
                      );
                    }}
                  >
                    <Type className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Settings panel */}

              <AnimatePresence>
                {showSettings && (
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
                    className="overflow-hidden border-t border-border bg-background/98"
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                  >
                    <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">
                          الخلفية
                        </span>

                        <div className="flex gap-2">
                          {Object.entries(
                            readingThemes
                          ).map(
                            ([
                              key,
                              val,
                            ]) => (
                              <button
                                key={
                                  key
                                }
                                onClick={() =>
                                  setTheme(
                                    key
                                  )
                                }
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                  theme ===
                                  key
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border"
                                }`}
                              >
                                {
                                  val.name
                                }
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16">
                          حجم الخط
                        </span>

                        <button
                          className="text-sm font-medium px-2"
                          onClick={() =>
                            setFontSize(
                              (s) =>
                                Math.max(
                                  14,
                                  s -
                                    2
                                )
                            )
                          }
                        >
                          A-
                        </button>

                        <div className="flex-1">
                          <Slider
                            value={[
                              fontSize,
                            ]}
                            min={14}
                            max={28}
                            step={1}
                            onValueChange={(
                              [v]
                            ) =>
                              setFontSize(
                                v
                              )
                            }
                          />
                        </div>

                        <button
                          className="text-sm font-medium px-2"
                          onClick={() =>
                            setFontSize(
                              (s) =>
                                Math.min(
                                  28,
                                  s +
                                    2
                                )
                            )
                          }
                        >
                          A+
                        </button>

                        <span className="text-xs text-muted-foreground w-8">
                          {
                            fontSize
                          }{" "}
                          px
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reading area */}

        <div className="flex-1 relative overflow-hidden mt-14">
          <AnimatePresence
            custom={direction}
            mode="wait"
          >
            <motion.article
              key={chapterId}
              ref={articleRef}
              custom={direction}
              variants={
                pageVariants
              }
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">

                {/* Chapter header */}

                <div className="text-center mb-10">
                  <div className="flex justify-center mb-4">
                    <div className="flex gap-1">
                      {[...Array(3)].map(
                        (_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              theme ===
                              "dark"
                                ? "bg-white/30"
                                : "bg-black/20"
                            }`}
                          />
                        )
                      )}
                    </div>
                  </div>

                  <p
                    className={`text-xs uppercase tracking-[0.2em] font-medium mb-2 ${
                      theme ===
                      "dark"
                        ? "text-white/40"
                        : "text-black/40"
                    }`}
                  >
                    الفصل{" "}
                    {
                      chapter.chapter_number
                    }
                  </p>

                  <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-1">
                    {
                      chapter.title
                    }
                  </h1>

                  {/* Chapter stats */}

                  <div
                    className={`flex justify-center items-center gap-4 mt-3 text-xs ${
                      theme ===
                      "dark"
                        ? "text-white/30"
                        : "text-black/30"
                    }`}
                  >
                    <span>
                      {wordCount.toLocaleString()}{" "}
                      كلمة
                    </span>

                    <span>
                      •
                    </span>

                    <span>
                      {readingTime}{" "}
                      دقيقة قراءة
                    </span>

                    <span>
                      •
                    </span>

                    {/* عدد القراء الحقيقي */}

                    <span
                      className="flex items-center gap-1"
                      title={
                        chapterReaderCount ==
                        null
                          ? "جاري تحميل عدد القراء"
                          : `عدد القراء: ${chapterReaderCount}`
                      }
                    >
                      <Eye className="w-3 h-3" />

                      {
                        displayedChapterReaderCount
                      }
                    </span>
                  </div>

                  <div className="flex justify-center mt-5">
                    <div
                      className={`h-px w-24 ${
                        theme ===
                        "dark"
                          ? "bg-white/10"
                          : "bg-black/10"
                      }`}
                    />
                  </div>
                </div>

                {/* Content */}

                <div
                  className="leading-[2] font-body"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: "2",
                  }}
                  dir="auto"
                >
                  {chapter.content
                    ?.split("\n")
                    .map(
                      (
                        para,
                        i
                      ) => {
                        const imgMatch =
                          para.match(
                            /^\[IMAGE:(.*?)\|(.*?)\]$/
                          );

                        const vidMatch =
                          para.match(
                            /^\[VIDEO:(.*?)\|(.*?)\]$/
                          );

                        const audioMatch =
                          para.match(
                            /^\[AUDIO:(.*?)\|(.*?)\]$/
                          );

                        if (
                          imgMatch
                        ) {
                          return (
                            <figure
                              key={i}
                              className="my-6"
                            >
                              <img
                                src={
                                  imgMatch[1]
                                }
                                alt={
                                  imgMatch[2]
                                }
                                className="w-full rounded-xl object-cover max-h-96"
                              />

                              {imgMatch[2] && (
                                <figcaption
                                  className={`text-center text-xs mt-2 ${
                                    theme ===
                                    "dark"
                                      ? "text-white/30"
                                      : "text-black/30"
                                  }`}
                                >
                                  {
                                    imgMatch[2]
                                  }
                                </figcaption>
                              )}
                            </figure>
                          );
                        }

                        if (
                          vidMatch
                        ) {
                          return (
                            <div
                              key={i}
                              className="my-6 rounded-xl overflow-hidden"
                            >
                              <video
                                src={
                                  vidMatch[1]
                                }
                                controls
                                className="w-full"
                              />

                              {vidMatch[2] && (
                                <p
                                  className={`text-center text-xs mt-2 ${
                                    theme ===
                                    "dark"
                                      ? "text-white/30"
                                      : "text-black/30"
                                  }`}
                                >
                                  {
                                    vidMatch[2]
                                  }
                                </p>
                              )}
                            </div>
                          );
                        }

                        if (
                          audioMatch
                        ) {
                          return (
                            <div
                              key={i}
                              className={`my-4 p-3 rounded-xl flex items-center gap-3 ${
                                theme ===
                                "dark"
                                  ? "bg-white/5"
                                  : "bg-black/5"
                              }`}
                            >
                              <audio
                                src={
                                  audioMatch[1]
                                }
                                controls
                                className="flex-1 h-8"
                              />
                            </div>
                          );
                        }

                        return para.trim() ? (
                          <p
                            key={i}
                            className="mb-6 indent-8 text-justify"
                          >
                            {para}
                          </p>
                        ) : (
                          <div
                            key={i}
                            className="flex justify-center my-6"
                          >
                            <span
                              className={`text-xs ${
                                theme ===
                                "dark"
                                  ? "text-white/20"
                                  : "text-black/20"
                              }`}
                            >
                              ✦
                            </span>
                          </div>
                        );
                      }
                    )}
                </div>

                {/* End page */}

                <div className="text-center mt-8">
                  <div className="flex justify-center">
                    <div
                      className={`h-px w-24 ${
                        theme ===
                        "dark"
                          ? "bg-white/10"
                          : "bg-black/10"
                      }`}
                    />
                  </div>

                  <p
                    className={`text-xs mt-3 ${
                      theme ===
                      "dark"
                        ? "text-white/20"
                        : "text-black/20"
                    }`}
                  >
                    {
                      chapter.chapter_number
                    }
                  </p>
                </div>

                {/* Next chapter CTA */}

                {nextChapter ? (
                  <button
                    onClick={() =>
                      goToChapter(
                        nextChapter,
                        1
                      )
                    }
                    disabled={
                      isFlipping
                    }
                    className={`w-full mt-8 p-4 rounded-2xl flex items-center justify-between gap-3 transition-colors disabled:opacity-50 ${
                      theme ===
                      "dark"
                        ? "bg-white/10 hover:bg-white/15 text-white"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    <div className="text-right min-w-0">
                      <p
                        className={`text-xs ${
                          theme ===
                          "dark"
                            ? "text-white/50"
                            : "opacity-80"
                        }`}
                      >
                        الفصل التالي
                      </p>

                      <p className="font-heading font-semibold line-clamp-1">
                        {
                          nextChapter.title
                        }
                      </p>
                    </div>

                    <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                  </button>
                ) : (
                  <div
                    className={`text-center mt-8 p-4 rounded-2xl border border-dashed ${
                      theme ===
                      "dark"
                        ? "border-white/15 text-white/40"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <p className="text-sm">
                      لقد وصلت إلى آخر فصل من هذه القصة
                    </p>
                  </div>
                )}

                {/* Chapter Comments */}

                <div
                  className={`mt-12 pt-8 border-t ${
                    theme ===
                    "dark"
                      ? "border-white/10"
                      : "border-black/10"
                  }`}
                >
                  <button
                    className={`flex items-center gap-2 text-sm font-medium mb-5 ${
                      theme ===
                      "dark"
                        ? "text-white/60 hover:text-white/90"
                        : "text-black/50 hover:text-black/80"
                    } transition-colors`}
                    onClick={() =>
                      setShowComments(
                        !showComments
                      )
                    }
                  >
                    <MessageCircle className="w-4 h-4" />

                    تعليقات الفصل (
                    {
                      chapterComments.length
                    }
                    )
                  </button>

                  {showComments && (
                    <div>

                      {/* Comment input */}

                      <div className="flex gap-2 mb-5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            theme ===
                            "dark"
                              ? "bg-white/10 text-white/70"
                              : "bg-black/10 text-black/70"
                          }`}
                        >
                          {(
                            user?.user_metadata
                              ?.full_name ||
                            user?.user_metadata
                              ?.name ||
                            user?.email ||
                            "U"
                          )[0]?.toUpperCase()}
                        </div>

                        <div className="flex-1 space-y-2">
                          <textarea
                            value={
                              commentText
                            }
                            onChange={(e) =>
                              setCommentText(
                                e.target
                                  .value
                              )
                            }
                            placeholder="أضف تعليقاً على هذا الفصل..."
                            rows={2}
                            className={`w-full text-sm px-3 py-2 rounded-xl resize-none border outline-none transition-colors ${
                              theme ===
                              "dark"
                                ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30"
                                : "bg-black/5 border-black/10 text-black placeholder:text-black/30 focus:border-black/30"
                            }`}
                          />

                          <button
                            disabled={
                              !commentText.trim() ||
                              commentMutation.isPending
                            }
                            onClick={() =>
                              commentMutation.mutate()
                            }
                            className={`flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full transition-colors disabled:opacity-40 ${
                              theme ===
                              "dark"
                                ? "bg-white/10 hover:bg-white/20 text-white/80"
                                : "bg-black/10 hover:bg-black/20 text-black/70"
                            }`}
                          >
                            <Send className="w-3 h-3" />

                            نشر
                          </button>
                        </div>
                      </div>

                      {/* Comments list */}

                      <div className="space-y-3">
                        {chapterComments.map(
                          (c) => (
                            <div
                              key={
                                c.id
                              }
                              className={`flex gap-2.5 p-3 rounded-xl ${
                                theme ===
                                "dark"
                                  ? "bg-white/5"
                                  : "bg-black/5"
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                  theme ===
                                  "dark"
                                    ? "bg-white/10 text-white/60"
                                    : "bg-black/10 text-black/60"
                                }`}
                              >
                                {c.author_name?.[0]?.toUpperCase() ||
                                  "?"}
                              </div>

                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span
                                    className={`text-xs font-semibold ${
                                      theme ===
                                      "dark"
                                        ? "text-white/70"
                                        : "text-black/70"
                                    }`}
                                  >
                                    {
                                      c.author_name
                                    }
                                  </span>

                                  {(c.created_at ||
                                    c.created_date) && (
                                    <span
                                      className={`text-[10px] ${
                                        theme ===
                                        "dark"
                                          ? "text-white/25"
                                          : "text-black/25"
                                      }`}
                                    >
                                      {format(
                                        new Date(
                                          c.created_at ||
                                            c.created_date
                                        ),
                                        "d MMM"
                                      )}
                                    </span>
                                  )}
                                </div>

                                <p
                                  className={`text-sm leading-relaxed ${
                                    theme ===
                                    "dark"
                                      ? "text-white/60"
                                      : "text-black/60"
                                  }`}
                                >
                                  {
                                    c.content
                                  }
                                </p>
                              </div>
                            </div>
                          )
                        )}

                        {chapterComments.length ===
                          0 && (
                          <p
                            className={`text-xs text-center py-4 ${
                              theme ===
                              "dark"
                                ? "text-white/20"
                                : "text-black/20"
                            }`}
                          >
                            كن أول من يعلّق على هذا الفصل
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        {/* Bottom nav */}

        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{
                y: 80,
              }}
              animate={{
                y: 0,
              }}
              exit={{
                y: 80,
              }}
              transition={{
                duration: 0.2,
              }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border py-3 pb-safe"
            >
              <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  className="gap-2 rounded-full"
                  disabled={
                    !prevChapter ||
                    isFlipping
                  }
                  onClick={() =>
                    goToChapter(
                      prevChapter,
                      -1
                    )
                  }
                >
                  <ChevronRight className="w-4 h-4" />

                  السابق
                </Button>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/story/${storyId}`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    >
                      <List className="w-5 h-5" />
                    </Button>
                  </Link>

                  <span className="text-xs text-muted-foreground">
                    {readProgress}%
                  </span>
                </div>

                <Button
                  variant="outline"
                  className="gap-2 rounded-full"
                  disabled={
                    !nextChapter ||
                    isFlipping
                  }
                  onClick={() =>
                    goToChapter(
                      nextChapter,
                      1
                    )
                  }
                >
                  التالي

                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}