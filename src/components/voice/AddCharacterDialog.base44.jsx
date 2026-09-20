import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Upload, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function AddCharacterDialog({ open, onOpenChange, user }) {
  const queryClient = useQueryClient();
  const [storyId, setStoryId] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [audioFile, setAudioFile] = useState(null);
  const [audioName, setAudioName] = useState("");

  const { data: myStories = [] } = useQuery({
    queryKey: ["my-stories-voice", user?.email],
    queryFn: () => base44.entities.Story.filter({ author_email: user.email }, "-created_date"),
    enabled: !!user,
  });

  const reset = () => {
    setStoryId(""); setName(""); setGender("male"); setAudioFile(null); setAudioName("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      // 1. Upload the reference audio to public storage → playable sample URL.
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: audioFile });

      let voiceId = null;
      let voiceName = null;
      // 2. Best-effort voice cloning (may fail on free ElevenLabs plans —
      //    the uploaded sample remains the playable audio either way).
      try {
        const cloneResp = await base44.functions.invoke("cloneVoice", {
          audio_url: file_url,
          name: `${name} - ${storyId.slice(0, 6)}`,
          gender,
        });
        if (cloneResp.data?.voice_id) {
          voiceId = cloneResp.data.voice_id;
          voiceName = name;
        }
      } catch {
        // cloning unavailable — sample audio is still playable
      }

      // 3. Save the character with the playable sample.
      return base44.entities.VoiceCharacter.create({
        story_id: storyId,
        name,
        gender,
        sample_audio_url: file_url,
        voice_id: voiceId,
        voice_name: voiceName,
        author_email: user.email,
        keywords: [name],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-characters-all"] });
      queryClient.invalidateQueries({ queryKey: ["voice-stories"] });
      reset();
      onOpenChange(false);
      toast.success("تمت إضافة الشخصية بنجاح!");
    },
    onError: (err) => toast.error("فشل الحفظ: " + (err.message || "")),
  });

  const canSubmit = storyId && name.trim() && audioFile && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" /> إضافة شخصية جديدة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>اختر قصتك *</Label>
            <Select value={storyId || undefined} onValueChange={setStoryId}>
              <SelectTrigger className="mt-1 rounded-xl">
                <BookOpen className="w-4 h-4 ml-2 text-muted-foreground" />
                <SelectValue placeholder="اختر قصة من قصصك..." />
              </SelectTrigger>
              <SelectContent>
                {myStories.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">لا توجد قصص. اكتب قصة أولاً.</p>
                )}
                {myStories.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>اسم الشخصية *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: ليلى، أحمد..."
              className="mt-1 rounded-xl"
            />
          </div>

          <div>
            <Label>جنس الشخصية *</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">ذكر</SelectItem>
                <SelectItem value="female">أنثى</SelectItem>
                <SelectItem value="narrator">راوي</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>ملف صوتي مرجعي *</Label>
            <label className="cursor-pointer block mt-1">
              <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors bg-muted/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{audioName || "انقر لرفع ملف صوتي"}</p>
                  <p className="text-xs text-muted-foreground">MP3, WAV — صوت واضح للشخصية</p>
                </div>
              </div>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files[0];
                  if (f) { setAudioFile(f); setAudioName(f.name); }
                }}
              />
            </label>
          </div>

          <Button
            className="w-full rounded-full"
            disabled={!canSubmit}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> جاري المعالجة...</>
              : "إنشاء الشخصية"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}