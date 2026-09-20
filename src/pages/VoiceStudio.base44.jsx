import React, { useState, useMemo, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Search, Plus, X, BookOpen, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import CharacterVoiceCard from "@/components/voice/CharacterVoiceCard";
import AddCharacterDialog from "@/components/voice/AddCharacterDialog";

export default function VoiceStudio() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  // All voice characters (public — visible to every visitor)
  const { data: allCharacters = [], isLoading } = useQuery({
    queryKey: ["voice-characters-all"],
    queryFn: () => base44.entities.VoiceCharacter.list("-created_date", 200),
  });

  const storyIds = useMemo(
    () => [...new Set(allCharacters.map(c => c.story_id).filter(Boolean))],
    [allCharacters]
  );

  const { data: stories = [] } = useQuery({
    queryKey: ["voice-stories", storyIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        storyIds.map(id => base44.entities.Story.get(id).catch(() => null))
      );
      return results.filter(Boolean);
    },
    enabled: storyIds.length > 0,
  });

  const charactersByStory = useMemo(() => {
    const map = {};
    allCharacters.forEach(c => {
      if (c.story_id) {
        if (!map[c.story_id]) map[c.story_id] = [];
        map[c.story_id].push(c);
      }
    });
    return map;
  }, [allCharacters]);

  const filteredStories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter(s =>
      (s.title || "").toLowerCase().includes(q) ||
      (s.author_name || "").toLowerCase().includes(q)
    );
  }, [stories, search]);

  const selectedCharacters = selectedStory ? (charactersByStory[selectedStory.id] || []) : [];

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const togglePlay = async (char) => {
    if (playingId === char.id) {
      stopAudio();
      setPlayingId(null);
      return;
    }
    stopAudio();

    // Primary: play the uploaded reference sample.
    if (char.sample_audio_url) {
      const audio = new Audio(char.sample_audio_url);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      setPlayingId(char.id);
      audio.play().catch(() => setPlayingId(null));
      return;
    }

    // Fallback for legacy characters with a cloned/preset voice_id: TTS preview.
    if (char.voice_id) {
      try {
        const resp = await base44.functions.invoke("elevenLabsTTS", {
          text: "مرحباً، هذه عينة صوتية للشخصية.",
          gender: char.gender,
          voice_id: char.voice_id,
        });
        const audioData = resp.data?.audio_base64;
        if (audioData) {
          const audio = new Audio(`data:audio/mpeg;base64,${audioData}`);
          audioRef.current = audio;
          audio.onended = () => setPlayingId(null);
          setPlayingId(char.id);
          audio.play().catch(() => setPlayingId(null));
        }
      } catch {
        setPlayingId(null);
      }
    }
  };

  const closeStoryDialog = () => {
    stopAudio();
    setPlayingId(null);
    setSelectedStory(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Mic className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl font-bold">استوديو الأصوات</h1>
          <p className="text-sm text-muted-foreground">اكتشف قصصاً بأصوات شخصيات مخصصة واستمع لعيناتها</p>
        </div>
        {user && (
          <Button className="gap-2 rounded-full flex-shrink-0" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">إضافة شخصية</span>
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="ابحث عن قصة..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10 rounded-full"
        />
        {search && (
          <button className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
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
            {search ? "لا توجد قصص مطابقة" : "لا توجد قصص بأصوات بعد"}
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search ? "جرّب كلمة أخرى" : "كن أول من يضيف شخصية بصوت"}
          </p>
          {user && !search && (
            <Button className="mt-4 rounded-full" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> إضافة شخصية
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredStories.map((story, i) => {
            const chars = charactersByStory[story.id] || [];
            return (
              <motion.button
                key={story.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => setSelectedStory(story)}
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
                      <Mic className="w-2.5 h-2.5" /> {chars.length} شخصية
                    </span>
                  </div>
                </div>
                <p className="font-semibold text-sm mt-2 line-clamp-1">{story.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{story.author_name}</p>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Story characters dialog */}
      <Dialog open={!!selectedStory} onOpenChange={(v) => { if (!v) closeStoryDialog(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">{selectedStory?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2 mb-4">
            شخصيات بصوت مخصص — استمع لعينة كل شخصية
          </p>
          <div className="space-y-3">
            {selectedCharacters.map(char => (
              <CharacterVoiceCard
                key={char.id}
                char={char}
                isPlaying={playingId === char.id}
                onTogglePlay={togglePlay}
              />
            ))}
            {selectedCharacters.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد شخصيات لهذه القصة</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add character dialog (logged-in users only) */}
      {user && <AddCharacterDialog open={showAdd} onOpenChange={setShowAdd} user={user} />}
    </div>
  );
}