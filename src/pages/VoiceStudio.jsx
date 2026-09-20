import React, { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mic,
  Search,
  Plus,
  X,
  BookOpen,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import CharacterVoiceCard from "@/components/voice/CharacterVoiceCard";
import AddCharacterDialog from "@/components/voice/AddCharacterDialog";
import { toast } from "sonner";

export default function VoiceStudio() {
  const { user: authUser } = useAuth();

  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const audioRef = useRef(null);

  const user = authUser;

  // جميع الشخصيات الصوتية
  const {
    data: allCharacters = [],
    isLoading,
  } = useQuery({
    queryKey: ["voice-characters-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_characters")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      return data || [];
    },
  });

  // القصص التي لديها شخصيات صوتية
  const storyIds = useMemo(
    () => [
      ...new Set(
        allCharacters
          .map((character) => character.story_id)
          .filter(Boolean)
      ),
    ],
    [allCharacters]
  );

  // جلب القصص التي لديها أصوات
  const {
    data: stories = [],
  } = useQuery({
    queryKey: ["voice-stories", storyIds.join(",")],

    queryFn: async () => {
      if (storyIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .in("id", storyIds);

      if (error) {
        throw error;
      }

      return data || [];
    },

    enabled: storyIds.length > 0,
  });

  // ترتيب الشخصيات حسب القصة
  const charactersByStory = useMemo(() => {
    const map = {};

    allCharacters.forEach((character) => {
      if (!character.story_id) {
        return;
      }

      if (!map[character.story_id]) {
        map[character.story_id] = [];
      }

      map[character.story_id].push(character);
    });

    return map;
  }, [allCharacters]);

  // اقتراحات البحث
  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      return [];
    }

    return stories
      .filter((story) => {
        const title = (story.title || "").toLowerCase();
        const author = (story.author_name || "").toLowerCase();

        return (
          title.includes(q) ||
          author.includes(q)
        );
      })
      .slice(0, 8);
  }, [stories, search]);

  // القصص التي تظهر في الشبكة
  const filteredStories = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      return stories;
    }

    return stories.filter((story) => {
      const title = (story.title || "").toLowerCase();
      const author = (story.author_name || "").toLowerCase();

      return (
        title.includes(q) ||
        author.includes(q)
      );
    });
  }, [stories, search]);

  const selectedCharacters = selectedStory
    ? charactersByStory[selectedStory.id] || []
    : [];

  // إيقاف الصوت
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  // تشغيل / إيقاف الصوت
  const togglePlay = async (char) => {
    if (playingId === char.id) {
      stopAudio();
      setPlayingId(null);
      return;
    }

    stopAudio();

    if (char.sample_audio_url) {
      const audio = new Audio(char.sample_audio_url);

      audioRef.current = audio;

      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingId(null);
        audioRef.current = null;
      };

      setPlayingId(char.id);

      audio.play().catch(() => {
        setPlayingId(null);
        audioRef.current = null;
      });

      return;
    }

    // التوافق مع الشخصيات القديمة
    if (char.voice_id) {
      setPlayingId(null);
    }
  };

  // حذف الشخصية الصوتية
  const handleDeleteCharacter = async (char) => {
    const currentEmail = String(user?.email || "")
      .trim()
      .toLowerCase();

    const ownerEmail = String(char?.author_email || "")
      .trim()
      .toLowerCase();

    // لا يسمح بالحذف إلا لصاحب الشخصية
    if (
      !currentEmail ||
      !ownerEmail ||
      currentEmail !== ownerEmail
    ) {
      toast.error(
        "لا يمكنك حذف صوت شخصية لا تملكها."
      );
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف الشخصية الصوتية "${char.name}"؟`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(char.id);

      const { error } = await supabase
        .from("voice_characters")
        .delete()
        .eq("id", char.id)
        .eq("author_email", user.email);

      if (error) {
        throw error;
      }

      if (playingId === char.id) {
        stopAudio();
        setPlayingId(null);
      }

      await queryClient.invalidateQueries({
        queryKey: ["voice-characters-all"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["voice-stories"],
      });

      toast.success(
        "تم حذف الشخصية الصوتية بنجاح."
      );
    } catch (error) {
      console.error(
        "Delete voice character error:",
        error
      );

      toast.error(
        error?.message ||
          "تعذر حذف الشخصية الصوتية."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const closeStoryDialog = () => {
    stopAudio();
    setPlayingId(null);
    setSelectedStory(null);
  };

  // تغيير البحث
  const handleSearchChange = (event) => {
    const value = event.target.value;

    setSearch(value);
    setShowSuggestions(
      value.trim().length > 0
    );
  };

  // اختيار اقتراح
  const handleSuggestionClick = (story) => {
    setSearch(story.title || "");
    setShowSuggestions(false);
    setSelectedStory(story);
  };

  // مسح البحث
  const clearSearch = () => {
    setSearch("");
    setShowSuggestions(false);
  };

  // التحقق من ملكية الشخصية
  const isCharacterOwner = (char) => {
    const currentEmail = String(user?.email || "")
      .trim()
      .toLowerCase();

    const ownerEmail = String(
      char?.author_email || ""
    )
      .trim()
      .toLowerCase();

    return Boolean(
      currentEmail &&
      ownerEmail &&
      currentEmail === ownerEmail
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">

        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Mic className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl font-bold">
            استوديو الأصوات
          </h1>

          <p className="text-sm text-muted-foreground">
            اكتشف قصصًا بأصوات شخصيات مخصصة واستمع لعيناتها
          </p>
        </div>

        {user && (
          <Button
            className="gap-2 rounded-full flex-shrink-0"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="w-4 h-4" />

            <span className="hidden sm:inline">
              إضافة شخصية
            </span>
          </Button>
        )}

      </div>

      {/* Search */}
      <div className="relative mb-6">

        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

        <Input
          placeholder="ابحث عن قصة..."
          value={search}
          onChange={handleSearchChange}
          onFocus={() => {
            if (search.trim()) {
              setShowSuggestions(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setShowSuggestions(false);
            }

            if (event.key === "Escape") {
              setShowSuggestions(false);
            }
          }}
          className="pr-10 rounded-full"
        />

        {search && (
          <button
            type="button"
            className="absolute left-3 top-1/2 -translate-y-1/2"
            onClick={clearSearch}
            aria-label="مسح البحث"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* اقتراحات البحث */}
        {showSuggestions &&
          search.trim() && (
            <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-2xl border border-border bg-background shadow-xl overflow-hidden">

              {searchSuggestions.length > 0 ? (
                <div className="py-1">

                  {searchSuggestions.map((story) => {
                    const chars =
                      charactersByStory[story.id] || [];

                    return (
                      <button
                        key={story.id}
                        type="button"
                        onClick={() =>
                          handleSuggestionClick(story)
                        }
                        className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-muted transition-colors"
                      >

                        <div className="w-10 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">

                          {story.cover_image ? (
                            <img
                              src={story.cover_image}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}

                        </div>

                        <div className="flex-1 min-w-0">

                          <p className="font-semibold text-sm truncate">
                            {story.title}
                          </p>

                          <p className="text-xs text-muted-foreground truncate">
                            {story.author_name ||
                              "كاتب غير معروف"}
                          </p>

                          <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
                            <Mic className="w-3 h-3" />
                            {chars.length} شخصية صوتية
                          </div>

                        </div>

                      </button>
                    );
                  })}

                </div>
              ) : (
                <div className="px-4 py-5 text-center">

                  <Mic className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />

                  <p className="text-sm font-medium text-muted-foreground">
                    لا توجد قصة صوتية مطابقة
                  </p>

                  <p className="text-xs text-muted-foreground/60 mt-1">
                    جرّب اسمًا آخر
                  </p>

                </div>
              )}

            </div>
          )}

      </div>

      {/* Stories grid */}
      {isLoading ? (

        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>

      ) : filteredStories.length === 0 ? (

        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">

          <Mic className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />

          <p className="font-medium text-muted-foreground">
            {search
              ? "لا توجد قصص مطابقة"
              : "لا توجد قصص بأصوات بعد"}
          </p>

          <p className="text-sm text-muted-foreground/60 mt-1">
            {search
              ? "جرّب كلمة أخرى"
              : "كن أول من يضيف شخصية بصوت"}
          </p>

          {user && !search && (
            <Button
              className="mt-4 rounded-full"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              إضافة شخصية
            </Button>
          )}

        </div>

      ) : (

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">

          {filteredStories.map((story, i) => {
            const chars =
              charactersByStory[story.id] || [];

            return (
              <motion.button
                key={story.id}
                initial={{
                  opacity: 0,
                  y: 12,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: Math.min(
                    i * 0.04,
                    0.3
                  ),
                }}
                onClick={() => {
                  setShowSuggestions(false);
                  setSelectedStory(story);
                }}
                className="text-right group"
              >

                <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-border bg-muted relative">

                  {story.cover_image ? (
                    <img
                      src={story.cover_image}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt=""
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                      <BookOpen className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">

                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white bg-black/40 px-2 py-0.5 rounded-full">

                      <Mic className="w-2.5 h-2.5" />

                      {chars.length} شخصية

                    </span>

                  </div>

                </div>

                <p className="font-semibold text-sm mt-2 line-clamp-1">
                  {story.title}
                </p>

                <p className="text-xs text-muted-foreground line-clamp-1">
                  {story.author_name}
                </p>

              </motion.button>
            );
          })}

        </div>
      )}

      {/* Story characters dialog */}
      <Dialog
        open={!!selectedStory}
        onOpenChange={(value) => {
          if (!value) {
            closeStoryDialog();
          }
        }}
      >

        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-2xl">

          <DialogHeader>
            <DialogTitle className="font-heading">
              {selectedStory?.title}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-2 mb-4">
            شخصيات بصوت مخصص — استمع لعينة كل شخصية
          </p>

          <div className="space-y-3">

            {selectedCharacters.map((char) => (
              <CharacterVoiceCard
                key={char.id}
                char={char}
                isPlaying={playingId === char.id}
                onTogglePlay={togglePlay}
                onDelete={handleDeleteCharacter}
                currentUserEmail={user?.email}
                isOwner={isCharacterOwner(char)}
                deleting={deletingId === char.id}
              />
            ))}

            {selectedCharacters.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                لا توجد شخصيات لهذه القصة
              </p>
            )}

          </div>

        </DialogContent>

      </Dialog>

      {/* Add character dialog */}
      {user && (
        <AddCharacterDialog
          open={showAdd}
          onOpenChange={setShowAdd}
          user={user}
        />
      )}

    </div>
  );
}