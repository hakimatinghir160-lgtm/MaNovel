import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  PenLine,
  BookOpen,
  Eye,
  Heart,
  Trash2,
  ImagePlus,
  CheckCircle2,
  Clock,
  PauseCircle,
  Edit3,
  Settings,
  ShieldAlert,
  Users,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import RichChapterEditor from "../components/editor/RichChapterEditor";
import GenreMultiPicker from "../components/stories/GenreMultiPicker";

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

const langLabels = {
  arabic: "العربية",
  darija: "الدارجة",
  french: "Français",
  english: "English",
};

const statusConfig = {
  ongoing: {
    label: "مستمرة",
    icon: Clock,
    color:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  completed: {
    label: "مكتملة",
    icon: CheckCircle2,
    color:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  paused: {
    label: "موقوفة",
    icon: PauseCircle,
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
};

export default function Write() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showNewStory, setShowNewStory] = useState(false);
  const [editingChapterForStory, setEditingChapterForStory] = useState(null);

  const [storyForm, setStoryForm] = useState({
    title: "",
    description: "",
    genre: "",
    genres: [],
    language: "arabic",
    status: "ongoing",
    is_adult: false,
  });

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);

  const [editingStoryId, setEditingStoryId] = useState(null);
  const [editingStory, setEditingStory] = useState(null);
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editingChapterStoryId, setEditingChapterStoryId] = useState(null);
  const [editChapterData, setEditChapterData] = useState(null);

  const { data: myStories = [], isLoading } = useQuery({
    queryKey: ["my-stories", user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .eq("author_email", user.email)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data || [];
    },
    enabled: !!user,
  });

  /*
   * عدد القراء الفريدين لكل قصة.
   *
   * كل مستخدم يُحسب مرة واحدة فقط لكل قصة،
   * حتى لو فتح القصة عدة مرات أو قرأ عدة فصول منها.
   */
  const { data: storyReaderCounts = {} } = useQuery({
    queryKey: [
      "my-story-reader-counts",
      myStories.map((story) => story.id).join(","),
    ],

    queryFn: async () => {
      if (!myStories.length) return {};

      const results = await Promise.all(
        myStories.map(async (story) => {
          const { data, error } = await supabase.rpc(
            "get_story_reader_count",
            {
              p_story_id: story.id,
            }
          );

          if (error) {
            console.error(
              `Error fetching readers for story ${story.id}:`,
              error
            );

            return {
              id: story.id,
              count: 0,
            };
          }

          return {
            id: story.id,
            count: Number(data) || 0,
          };
        })
      );

      return results.reduce((acc, item) => {
        acc[item.id] = item.count;
        return acc;
      }, {});
    },

    enabled: !!user && myStories.length > 0,

    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const createStoryMutation = useMutation({
    mutationFn: async () => {
      let cover_image = "";

      if (coverFile) {
        const safeName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");

        const filePath = `covers/${user.id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("story-covers")
          .upload(filePath, coverFile, {
            upsert: false,
            contentType: coverFile.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("story-covers")
          .getPublicUrl(filePath);

        cover_image = publicUrlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("stories")
        .insert({
          ...storyForm,
          cover_image,
          author_name: user.display_name || user.full_name || user.email,
          author_email: user.email,
          is_approved: true,
          views: 0,
          likes_count: 0,
          chapters_count: 0,
          is_featured: false,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    },

    onSuccess: () => {
      setShowNewStory(false);

      setStoryForm({
        title: "",
        description: "",
        genre: "",
        genres: [],
        language: "arabic",
        status: "ongoing",
        is_adult: false,
      });

      setCoverFile(null);
      setCoverPreview(null);

      queryClient.invalidateQueries({
        queryKey: ["my-stories"],
      });

      toast.success("تم إنشاء القصة بنجاح!");
    },

    onError: (error) => {
      console.error("Create story error:", error);
      toast.error(error.message || "تعذر إنشاء القصة");
    },
  });

  const createChapterMutation = useMutation({
    mutationFn: async ({ title, content }) => {
      const { data: existingChapters, error: chaptersError } = await supabase
        .from("chapters")
        .select("id, chapter_number")
        .eq("story_id", editingChapterForStory)
        .order("chapter_number", { ascending: true });

      if (chaptersError) throw chaptersError;

      const chapterNumber = (existingChapters?.length || 0) + 1;

      const { data, error } = await supabase
        .from("chapters")
        .insert({
          title,
          content,
          story_id: editingChapterForStory,
          chapter_number: chapterNumber,
          is_published: true,
          views: 0,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: storyError } = await supabase
        .from("stories")
        .update({
          chapters_count: chapterNumber,
        })
        .eq("id", editingChapterForStory);

      if (storyError) throw storyError;

      return data;
    },

    onSuccess: () => {
      setEditingChapterForStory(null);

      queryClient.invalidateQueries({
        queryKey: ["my-stories"],
      });

      queryClient.invalidateQueries({
        queryKey: ["story-chapters-manage"],
      });

      toast.success("تم نشر الفصل!");
    },

    onError: (error) => {
      console.error("Create chapter error:", error);
      toast.error(error.message || "تعذر نشر الفصل");
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updatedChapter, error } = await supabase
        .from("chapters")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return updatedChapter;
    },

    onSuccess: () => {
      setEditingChapterId(null);
      setEditingChapterStoryId(null);
      setEditChapterData(null);

      queryClient.invalidateQueries({
        queryKey: ["story-chapters-manage"],
      });

      toast.success("تم تحديث الفصل!");
    },

    onError: (error) => {
      console.error("Update chapter error:", error);
      toast.error(error.message || "تعذر تحديث الفصل");
    },
  });

  const updateStoryMutation = useMutation({
    mutationFn: async (data) => {
      const { data: updatedStory, error } = await supabase
        .from("stories")
        .update(data)
        .eq("id", editingStoryId)
        .select()
        .single();

      if (error) throw error;

      return updatedStory;
    },

    onSuccess: () => {
      setEditingStoryId(null);
      setEditingStory(null);

      queryClient.invalidateQueries({
        queryKey: ["my-stories"],
      });

      toast.success("تم تحديث القصة!");
    },

    onError: (error) => {
      console.error("Update story error:", error);
      toast.error(error.message || "تعذر تحديث القصة");
    },
  });

  const { data: editingStoryChapters = [] } = useQuery({
    queryKey: ["story-chapters-manage", editingStoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("story_id", editingStoryId)
        .order("chapter_number", { ascending: true });

      if (error) throw error;

      return data || [];
    },
    enabled: !!editingStoryId,
  });

  const deleteStoryMutation = useMutation({
    mutationFn: async (storyId) => {
      const { error } = await supabase
        .from("stories")
        .delete()
        .eq("id", storyId);

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["my-stories"],
      });

      toast.success("تم حذف القصة");
    },

    onError: (error) => {
      console.error("Delete story error:", error);
      toast.error(
        error.message ||
          "تعذر حذف القصة. قد تكون هناك بيانات مرتبطة بها."
      );
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (chapter) => {
      const { error: deleteError } = await supabase
        .from("chapters")
        .delete()
        .eq("id", chapter.id);

      if (deleteError) throw deleteError;

      const { data: remaining, error: remainingError } = await supabase
        .from("chapters")
        .select("id, chapter_number")
        .eq("story_id", editingStoryId)
        .order("chapter_number", { ascending: true });

      if (remainingError) throw remainingError;

      if (remaining?.length) {
        await Promise.all(
          remaining.map((ch, index) =>
            supabase
              .from("chapters")
              .update({
                chapter_number: index + 1,
              })
              .eq("id", ch.id)
          )
        );
      }

      const { error: storyError } = await supabase
        .from("stories")
        .update({
          chapters_count: remaining?.length || 0,
        })
        .eq("id", editingStoryId);

      if (storyError) throw storyError;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["story-chapters-manage"],
      });

      queryClient.invalidateQueries({
        queryKey: ["my-stories"],
      });

      queryClient.invalidateQueries({
        queryKey: ["chapters"],
      });

      toast.success("تم حذف الفصل");
    },

    onError: (error) => {
      console.error("Delete chapter error:", error);
      toast.error(error.message || "تعذر حذف الفصل");
    },
  });

  if (!user) return null;

  if (editingChapterForStory) {
    const story = myStories.find(
      (s) => s.id === editingChapterForStory
    );

    return (
      <div className="min-h-screen p-4 sm:p-6">
        <RichChapterEditor
          storyTitle={story?.title}
          onSave={(data) => createChapterMutation.mutate(data)}
          onCancel={() => setEditingChapterForStory(null)}
          isSaving={createChapterMutation.isPending}
        />
      </div>
    );
  }

  // عدد المشاهدات هنا أصبح عدد القراء الفريدين لكل القصص
  const totalViews = myStories.reduce(
    (total, story) =>
      total + (storyReaderCounts[story.id] || 0),
    0
  );

  const totalLikes = myStories.reduce(
    (s, st) => s + (st.likes_count || 0),
    0
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold">
            قصصي
          </h1>

          <p className="text-muted-foreground mt-1 text-sm">
            أنشئ وأدر رواياتك
          </p>
        </div>

        <Dialog
          open={showNewStory}
          onOpenChange={(v) => {
            setShowNewStory(v);

            if (!v) {
              setCoverPreview(null);
              setCoverFile(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-full px-5 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" />
              قصة جديدة
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">
                إنشاء قصة جديدة
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <div>
                <Label className="mb-2 block">
                  غلاف القصة (البوستر)
                </Label>

                <label className="cursor-pointer block">
                  <div className="relative group w-full h-52 rounded-2xl border-2 border-dashed border-border overflow-hidden hover:border-primary transition-colors bg-muted/20">
                    {coverPreview ? (
                      <img
                        src={coverPreview}
                        className="w-full h-full object-cover"
                        alt="preview"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          <ImagePlus className="w-5 h-5" />
                        </div>

                        <div className="text-center">
                          <p className="text-sm font-medium">
                            انقر لرفع صورة الغلاف
                          </p>

                          <p className="text-xs mt-0.5">
                            PNG، JPG، WEBP
                          </p>
                        </div>
                      </div>
                    )}

                    {coverPreview && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          تغيير الغلاف
                        </span>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverChange}
                  />
                </label>
              </div>

              <div>
                <Label>عنوان القصة *</Label>

                <Input
                  value={storyForm.title}
                  onChange={(e) =>
                    setStoryForm({
                      ...storyForm,
                      title: e.target.value,
                    })
                  }
                  placeholder="أدخل عنوان القصة"
                  className="mt-1 rounded-xl"
                />
              </div>

              <div>
                <Label>وصف القصة</Label>

                <Textarea
                  value={storyForm.description}
                  onChange={(e) =>
                    setStoryForm({
                      ...storyForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="اكتب ملخصاً قصيراً يشوّق القراء..."
                  rows={3}
                  className="mt-1 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>النوع الرئيسي *</Label>

                  <Select
                    value={storyForm.genre}
                    onValueChange={(v) =>
                      setStoryForm({
                        ...storyForm,
                        genre: v,
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>

                    <SelectContent>
                      {Object.entries(genreLabels).map(
                        ([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>اللغة *</Label>

                  <Select
                    value={storyForm.language}
                    onValueChange={(v) =>
                      setStoryForm({
                        ...storyForm,
                        language: v,
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="arabic">
                        العربية
                      </SelectItem>

                      <SelectItem value="darija">
                        الدارجة
                      </SelectItem>

                      <SelectItem value="french">
                        Français
                      </SelectItem>

                      <SelectItem value="english">
                        English
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">
                  أنماط إضافية
                </Label>

                <GenreMultiPicker
                  selected={storyForm.genres}
                  onChange={(v) =>
                    setStoryForm({
                      ...storyForm,
                      genres: v,
                    })
                  }
                />
              </div>

              <div>
                <Label>حالة القصة</Label>

                <Select
                  value={storyForm.status}
                  onValueChange={(v) =>
                    setStoryForm({
                      ...storyForm,
                      status: v,
                    })
                  }
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ongoing">
                      مستمرة
                    </SelectItem>

                    <SelectItem value="completed">
                      مكتملة
                    </SelectItem>

                    <SelectItem value="paused">
                      موقوفة
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      storyForm.is_adult
                        ? "bg-red-500/10"
                        : "bg-muted"
                    }`}
                  >
                    {storyForm.is_adult ? (
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                    ) : (
                      <Users className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      الجمهور المستهدف
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {storyForm.is_adult
                        ? "محتوى للبالغين (+18)"
                        : "للجمهور العام"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setStoryForm({
                        ...storyForm,
                        is_adult: false,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      !storyForm.is_adult
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    للعامة
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setStoryForm({
                        ...storyForm,
                        is_adult: true,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      storyForm.is_adult
                        ? "bg-red-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    +18
                  </button>
                </div>
              </div>

              <Button
                className="w-full rounded-full"
                disabled={
                  !storyForm.title ||
                  !storyForm.genre ||
                  createStoryMutation.isPending
                }
                onClick={() =>
                  createStoryMutation.mutate()
                }
              >
                {createStoryMutation.isPending
                  ? "جاري الإنشاء..."
                  : "إنشاء القصة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {myStories.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            {
              label: "قصة",
              num: myStories.length,
              icon: BookOpen,
              color: "text-primary",
            },
            {
              label: "مشاهدة",
              num: totalViews.toLocaleString(),
              icon: Eye,
              color: "text-blue-500",
            },
            {
              label: "إعجاب",
              num: totalLikes,
              icon: Heart,
              color: "text-rose-500",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3"
            >
              <div
                className={`w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 ${s.color}`}
              >
                <s.icon className="w-4 h-4" />
              </div>

              <div>
                <p className="font-bold text-lg leading-none">
                  {s.num}
                </p>

                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {Array(2)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="h-52 bg-muted rounded-2xl animate-pulse"
              />
            ))}
        </div>
      ) : myStories.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24 border-2 border-dashed border-border rounded-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <PenLine className="w-7 h-7 text-muted-foreground/50" />
          </div>

          <h3 className="font-heading text-xl font-semibold">
            لا توجد قصص بعد
          </h3>

          <p className="text-muted-foreground mt-2 text-sm">
            ابدأ بكتابة روايتك الأولى وشارك إبداعك مع العالم
          </p>

          <Button
            className="mt-5 rounded-full gap-2"
            onClick={() => setShowNewStory(true)}
          >
            <Plus className="w-4 h-4" />
            إنشاء قصة
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {myStories.map((story, i) => {
            const sc =
              statusConfig[story.status] ||
              statusConfig.ongoing;

            const StatusIcon = sc.icon;

            return (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4 p-4">
                  <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 bg-muted border border-border">
                    {story.cover_image ? (
                      <img
                        src={story.cover_image}
                        className="w-full h-full object-cover"
                        alt={story.title}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <BookOpen className="w-7 h-7 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h2 className="font-heading font-bold text-base leading-tight line-clamp-2">
                        {story.title}
                      </h2>

                      {story.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {story.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {genreLabels[story.genre] ||
                            story.genre}
                        </span>

                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {langLabels[story.language]}
                        </span>

                        <span
                          className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border font-medium ${sc.color}`}
                        >
                          <StatusIcon className="w-2.5 h-2.5" />
                          {sc.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {storyReaderCounts[story.id] || 0}
                      </span>

                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {story.likes_count || 0}
                      </span>

                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {story.chapters_count || 0} فصل
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-2 p-3">
                  <Button
                    size="sm"
                    className="gap-1.5 rounded-full flex-1 shadow-sm shadow-primary/10"
                    onClick={() =>
                      setEditingChapterForStory(story.id)
                    }
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    إضافة فصل
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full gap-1.5"
                    onClick={() => {
                      setEditingStoryId(story.id);
                      setEditingStory({
                        status: story.status,
                        description: story.description || "",
                        is_adult: story.is_adult || false,
                      });
                    }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </Button>

                  <Link to={`/story/${story.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      عرض
                    </Button>
                  </Link>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (
                        confirm(
                          "هل تريد حذف هذه القصة نهائياً؟"
                        )
                      ) {
                        deleteStoryMutation.mutate(story.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!editingStoryId}
        onOpenChange={(v) => {
          if (!v) {
            setEditingStoryId(null);
            setEditingStory(null);
            setEditingChapterId(null);
            setEditChapterData(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              إعدادات القصة
            </DialogTitle>
          </DialogHeader>

          {editingStory && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    الكاتب
                  </p>

                  <p className="text-sm font-medium">
                    {user.display_name || user.full_name}
                  </p>
                </div>
              </div>

              <div>
                <Label>وصف القصة</Label>

                <Textarea
                  value={editingStory.description}
                  onChange={(e) =>
                    setEditingStory({
                      ...editingStory,
                      description: e.target.value,
                    })
                  }
                  placeholder="وصف مختصر للقصة..."
                  rows={3}
                  className="mt-1 rounded-xl"
                />
              </div>

              <div>
                <Label>حالة القصة</Label>

                <Select
                  value={editingStory.status}
                  onValueChange={(v) =>
                    setEditingStory({
                      ...editingStory,
                      status: v,
                    })
                  }
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ongoing">
                      مستمرة
                    </SelectItem>

                    <SelectItem value="completed">
                      مكتملة
                    </SelectItem>

                    <SelectItem value="paused">
                      موقوفة
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      editingStory.is_adult
                        ? "bg-red-500/10"
                        : "bg-muted"
                    }`}
                  >
                    {editingStory.is_adult ? (
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                    ) : (
                      <Users className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      الجمهور المستهدف
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {editingStory.is_adult
                        ? "محتوى للبالغين (+18)"
                        : "للجمهور العام"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingStory({
                        ...editingStory,
                        is_adult: false,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      !editingStory.is_adult
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    للعامة
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingStory({
                        ...editingStory,
                        is_adult: true,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      editingStory.is_adult
                        ? "bg-red-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    +18
                  </button>
                </div>
              </div>

              <Button
                className="w-full rounded-full"
                disabled={updateStoryMutation.isPending}
                onClick={() =>
                  updateStoryMutation.mutate(editingStory)
                }
              >
                {updateStoryMutation.isPending
                  ? "جاري الحفظ..."
                  : "حفظ التغييرات"}
              </Button>

              <Separator />

              <div>
                <h3 className="font-semibold text-sm mb-3">
                  تعديل الفصول ({editingStoryChapters.length})
                </h3>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editingStoryChapters.map((ch) => (
                    <div key={ch.id}>
                      {editingChapterId === ch.id &&
                      editChapterData ? (
                        <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                          <Input
                            value={editChapterData.title}
                            onChange={(e) =>
                              setEditChapterData({
                                ...editChapterData,
                                title: e.target.value,
                              })
                            }
                            className="rounded-lg text-sm"
                            placeholder="عنوان الفصل"
                          />

                          <Textarea
                            value={editChapterData.content}
                            onChange={(e) =>
                              setEditChapterData({
                                ...editChapterData,
                                content: e.target.value,
                              })
                            }
                            rows={6}
                            className="rounded-lg text-sm"
                            placeholder="محتوى الفصل..."
                          />

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="rounded-full flex-1"
                              disabled={
                                updateChapterMutation.isPending
                              }
                              onClick={() =>
                                updateChapterMutation.mutate({
                                  id: ch.id,
                                  data: editChapterData,
                                })
                              }
                            >
                              {updateChapterMutation.isPending
                                ? "حفظ..."
                                : "حفظ"}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => {
                                setEditingChapterId(null);
                                setEditChapterData(null);
                              }}
                            >
                              إلغاء
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-primary w-5 text-center flex-shrink-0">
                              {ch.chapter_number}
                            </span>

                            <span className="text-sm font-medium line-clamp-1">
                              {ch.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full h-7 w-7 p-0"
                              onClick={() => {
                                setEditingChapterId(ch.id);
                                setEditChapterData({
                                  title: ch.title,
                                  content: ch.content,
                                });
                              }}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={
                                deleteChapterMutation.isPending
                              }
                              onClick={() => {
                                if (
                                  confirm(
                                    "هل تريد حذف هذا الفصل؟"
                                  )
                                ) {
                                  deleteChapterMutation.mutate(
                                    ch
                                  );
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}