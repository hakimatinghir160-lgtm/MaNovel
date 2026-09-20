import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Mic,
  Upload,
  Loader2,
  BookOpen,
  Play,
  Pause,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function AddCharacterDialog({
  open,
  onOpenChange,
  user,
}) {
  const queryClient = useQueryClient();

  const [storyId, setStoryId] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [audioFile, setAudioFile] = useState(null);
  const [audioName, setAudioName] = useState("");

  const [previewUrl, setPreviewUrl] = useState("");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const audioRef = useRef(null);

  /*
   * جلب قصص المستخدم
   */
  const {
    data: myStories = [],
    isLoading: storiesLoading,
  } = useQuery({
    queryKey: ["my-stories-voice", user?.email],

    queryFn: async () => {
      if (!user?.email) {
        return [];
      }

      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .eq("author_email", user.email)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading stories:", error);
        throw error;
      }

      return data || [];
    },

    enabled: !!user?.email,
  });

  /*
   * إيقاف المعاينة الصوتية
   */
  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setIsPreviewPlaying(false);
  };

  /*
   * تنظيف المعاينة
   */
  useEffect(() => {
    return () => {
      stopPreview();

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /*
   * إعادة ضبط النموذج
   */
  const reset = () => {
    stopPreview();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setStoryId("");
    setName("");
    setGender("male");
    setAudioFile(null);
    setAudioName("");
    setPreviewUrl("");
    setIsPreviewPlaying(false);
  };

  /*
   * اختيار الملف الصوتي
   */
  const handleAudioChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    /*
     * التأكد أن الملف صوتي
     */
    if (!file.type.startsWith("audio/")) {
      toast.error("الملف المختار ليس ملفًا صوتيًا.");
      event.target.value = "";
      return;
    }

    /*
     * حد أقصى 25MB
     */
    const maxSize = 25 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("حجم الملف كبير جدًا. الحد الأقصى هو 25MB.");
      event.target.value = "";
      return;
    }

    stopPreview();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const localUrl = URL.createObjectURL(file);

    setAudioFile(file);
    setAudioName(file.name);
    setPreviewUrl(localUrl);
  };

  /*
   * تشغيل / إيقاف معاينة الملف قبل إنشاء الشخصية
   */
  const togglePreview = () => {
    if (!previewUrl) {
      return;
    }

    if (isPreviewPlaying) {
      stopPreview();
      return;
    }

    const audio = new Audio(previewUrl);

    audioRef.current = audio;

    audio.onended = () => {
      setIsPreviewPlaying(false);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setIsPreviewPlaying(false);
      audioRef.current = null;
      toast.error("تعذر تشغيل الملف الصوتي.");
    };

    audio
      .play()
      .then(() => {
        setIsPreviewPlaying(true);
      })
      .catch((error) => {
        console.error("Audio preview error:", error);
        setIsPreviewPlaying(false);
        toast.error("تعذر تشغيل الملف الصوتي.");
      });
  };

  /*
   * إنشاء الشخصية
   */
  const createMutation = useMutation({
    mutationFn: async () => {
      /*
       * التحقق من المستخدم
       */
      if (!user?.id || !user?.email) {
        throw new Error(
          "يجب تسجيل الدخول قبل إنشاء شخصية صوتية."
        );
      }

      /*
       * التحقق من القصة
       */
      if (!storyId) {
        throw new Error("يرجى اختيار قصة.");
      }

      /*
       * التحقق من الاسم
       */
      const characterName = name.trim();

      if (!characterName) {
        throw new Error("يرجى كتابة اسم الشخصية.");
      }

      /*
       * التحقق من الملف
       */
      if (!audioFile) {
        throw new Error("يرجى اختيار ملف صوتي.");
      }

      if (!audioFile.type.startsWith("audio/")) {
        throw new Error(
          "الملف المختار ليس ملفًا صوتيًا صالحًا."
        );
      }

      /*
       * إنشاء اسم آمن للملف
       *
       * مهم:
       * لا نستخدم اسم الشخصية هنا حتى لا تدخل
       * الحروف العربية إلى مسار Supabase Storage.
       *
       * اسم الشخصية العربي يبقى محفوظًا عاديًا
       * في قاعدة البيانات.
       */
      const fileExtension =
        audioFile.name.split(".").pop()?.toLowerCase() || "mp3";

      const uniqueFileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}.${fileExtension}`;

      const filePath = `${user.id}/${uniqueFileName}`;

      console.log("Uploading audio:", {
        bucket: "voice-samples",
        filePath,
        fileName: audioFile.name,
        type: audioFile.type,
        size: audioFile.size,
      });

      /*
       * رفع الملف إلى Storage
       */
      const { error: uploadError } = await supabase.storage
        .from("voice-samples")
        .upload(filePath, audioFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: audioFile.type,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);

        throw new Error(
          uploadError.message ||
            "تعذر رفع الملف الصوتي إلى التخزين."
        );
      }

      /*
       * الحصول على الرابط العام للملف
       */
      const {
        data: publicUrlData,
      } = supabase.storage
        .from("voice-samples")
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData?.publicUrl;

      if (!fileUrl) {
        throw new Error(
          "تم رفع الملف ولكن تعذر إنشاء رابط الصوت."
        );
      }

      console.log(
        "Audio uploaded successfully:",
        fileUrl
      );

      /*
       * DEBUG:
       * التحقق من المستخدم الحالي والقيم التي سيتم
       * إرسالها إلى voice_characters
       */
      console.log("AUTH DEBUG:", {
        userId: user?.id,
        userEmail: user?.email,
        storyId,
        characterName,
        gender,
        authorEmailToInsert: user?.email,
      });

      /*
       * التحقق الإضافي من جلسة Supabase الحالية
       *
       * هذا يسمح لنا بمعرفة الإيميل الذي يوجد
       * فعليًا داخل جلسة Supabase Auth.
       */
      const {
        data: {
          user: supabaseUser,
        },
        error: authError,
      } = await supabase.auth.getUser();

      console.log("SUPABASE AUTH DEBUG:", {
        authUserId: supabaseUser?.id,
        authUserEmail: supabaseUser?.email,
        authError: authError?.message || null,
      });

      /*
       * إنشاء الشخصية في قاعدة البيانات
       */
      const { data, error: insertError } = await supabase
        .from("voice_characters")
        .insert({
          story_id: storyId,
          name: characterName,
          gender,
          sample_audio_url: fileUrl,
          voice_id: null,
          voice_name: null,
          author_email: user.email,
          keywords: [characterName],
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          "Voice character insert error:",
          insertError
        );

        /*
         * إذا فشل حفظ الشخصية، نحاول حذف الملف
         * حتى لا تبقى ملفات صوتية غير مرتبطة بشخصية.
         */
        await supabase.storage
          .from("voice-samples")
          .remove([filePath]);

        throw new Error(
          insertError.message ||
            "تم رفع الصوت لكن تعذر إنشاء الشخصية."
        );
      }

      console.log(
        "Voice character created:",
        data
      );

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["voice-characters-all"],
      });

      queryClient.invalidateQueries({
        queryKey: ["voice-stories"],
      });

      queryClient.invalidateQueries({
        queryKey: ["my-stories-voice", user?.email],
      });

      reset();

      onOpenChange(false);

      toast.success(
        "تم إنشاء الشخصية وحفظ الصوت بنجاح!"
      );
    },

    onError: (error) => {
      console.error(
        "Create voice character error:",
        error
      );

      toast.error(
        error?.message ||
          "حدث خطأ أثناء إنشاء الشخصية."
      );
    },
  });

  const canSubmit =
    Boolean(storyId) &&
    Boolean(name.trim()) &&
    Boolean(audioFile) &&
    !createMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          reset();
        }

        onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            إضافة شخصية جديدة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          {/* اختيار القصة */}
          <div>
            <Label>اختر قصتك *</Label>

            <Select
              value={storyId || undefined}
              onValueChange={setStoryId}
              disabled={storiesLoading}
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <BookOpen className="w-4 h-4 ml-2 text-muted-foreground" />

                <SelectValue
                  placeholder={
                    storiesLoading
                      ? "جاري تحميل قصصك..."
                      : "اختر قصة من قصصك..."
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {myStories.length === 0 &&
                  !storiesLoading && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      لا توجد قصص. اكتب قصة أولاً.
                    </p>
                  )}

                {myStories.map((story) => (
                  <SelectItem
                    key={story.id}
                    value={story.id}
                  >
                    {story.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* اسم الشخصية */}
          <div>
            <Label>اسم الشخصية *</Label>

            <Input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="مثال: ليلى، أحمد..."
              className="mt-1 rounded-xl"
            />
          </div>

          {/* الجنس */}
          <div>
            <Label>جنس الشخصية *</Label>

            <Select
              value={gender}
              onValueChange={setGender}
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="male">
                  ذكر
                </SelectItem>

                <SelectItem value="female">
                  أنثى
                </SelectItem>

                <SelectItem value="narrator">
                  راوي
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* الملف الصوتي */}
          <div>
            <Label>ملف صوتي *</Label>

            <label className="cursor-pointer block mt-1">
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed transition-colors bg-muted/30 ${
                  audioFile
                    ? "border-primary"
                    : "border-border hover:border-primary"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {audioFile ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Upload className="w-5 h-5 text-primary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {audioName ||
                      "انقر لرفع ملف صوتي"}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    MP3, WAV — حد أقصى 25MB
                  </p>
                </div>
              </div>

              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioChange}
              />
            </label>

            {/* مشغل المعاينة */}
            {audioFile && previewUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <button
                  type="button"
                  onClick={togglePreview}
                  className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
                  aria-label={
                    isPreviewPlaying
                      ? "إيقاف المعاينة"
                      : "تشغيل المعاينة"
                  }
                >
                  {isPreviewPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {isPreviewPlaying
                      ? "جاري تشغيل الصوت..."
                      : "معاينة الصوت"}
                  </p>

                  <p className="text-[11px] text-muted-foreground truncate">
                    يمكنك الاستماع إليه قبل إنشاء الشخصية
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* إنشاء الشخصية */}
          <Button
            type="button"
            className="w-full rounded-full"
            disabled={!canSubmit}
            onClick={() => {
              console.log(
                "CREATE CHARACTER BUTTON CLICKED"
              );

              createMutation.mutate();
            }}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                جاري رفع وحفظ الصوت...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-1" />
                إنشاء الشخصية
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}