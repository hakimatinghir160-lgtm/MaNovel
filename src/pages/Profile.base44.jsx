import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, BookOpen, Users, Edit, Camera, PenLine, Heart, Eye, Clock, BookMarked, UserCheck } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import StoryCard from "../components/stories/StoryCard";
import { toast } from "sonner";
import { motion } from "framer-motion";
import MobileDetailHeader from "@/components/layout/MobileDetailHeader";

export default function Profile() {
  const { email } = useParams();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ bio: "", avatar_url: "", display_name: "" });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const profileEmail = email || currentUser?.email;
  const isOwnProfile = currentUser?.email === profileEmail;

  const { data: profileUser } = useQuery({
    queryKey: ["profile-user", profileEmail],
    queryFn: async () => {
      if (isOwnProfile && currentUser) return currentUser;
      const users = await base44.entities.User.filter({ email: profileEmail });
      return users[0] || null;
    },
    enabled: !!profileEmail,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ["user-stories", profileEmail],
    queryFn: () => base44.entities.Story.filter({ author_email: profileEmail, is_approved: true }, "-created_date"),
    enabled: !!profileEmail,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ["followers", profileEmail],
    queryFn: () => base44.entities.Follow.filter({ following_email: profileEmail }),
    enabled: !!profileEmail,
  });

  const { data: following = [] } = useQuery({
    queryKey: ["following", profileEmail],
    queryFn: () => base44.entities.Follow.filter({ follower_email: profileEmail }),
    enabled: !!profileEmail,
  });

  // Stories the user has read (entered at least one chapter)
  const { data: readProgress = [] } = useQuery({
    queryKey: ["reading-progress", profileEmail],
    queryFn: () => base44.entities.ReadingProgress.filter({ user_email: profileEmail }),
    enabled: !!profileEmail,
  });
  const readStoryIds = useMemo(
    () => [...new Set(readProgress.map((p) => p.story_id).filter(Boolean))],
    [readProgress]
  );
  const { data: readStories = [] } = useQuery({
    queryKey: ["read-stories", readStoryIds.join(",")],
    queryFn: async () => {
      if (readStoryIds.length === 0) return [];
      const results = await Promise.all(
        readStoryIds.map((id) => base44.entities.Story.get(id).catch(() => null))
      );
      return results.filter(Boolean);
    },
    enabled: readStoryIds.length > 0,
  });

  const { data: isFollowing = false } = useQuery({
    queryKey: ["is-following", profileEmail, currentUser?.email],
    queryFn: async () => {
      if (!currentUser || isOwnProfile) return false;
      const follows = await base44.entities.Follow.filter({
        follower_email: currentUser.email,
        following_email: profileEmail,
      });
      return follows.length > 0;
    },
    enabled: !!currentUser && !!profileEmail && !isOwnProfile,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) { base44.auth.redirectToLogin(); return; }
      if (isFollowing) {
        const follows = await base44.entities.Follow.filter({ follower_email: currentUser.email, following_email: profileEmail });
        if (follows[0]) await base44.entities.Follow.delete(follows[0].id);
      } else {
        await base44.entities.Follow.create({ follower_email: currentUser.email, following_email: profileEmail });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following"] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
    },
  });

  // Check if username change is allowed (every 5 days)
  const canChangeUsername = () => {
    const lastChanged = currentUser?.username_last_changed;
    if (!lastChanged) return true;
    return differenceInDays(new Date(), parseISO(lastChanged)) >= 5;
  };
  const daysUntilChange = () => {
    const lastChanged = currentUser?.username_last_changed;
    if (!lastChanged) return 0;
    return Math.max(0, 5 - differenceInDays(new Date(), parseISO(lastChanged)));
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      let avatar_url = editForm.avatar_url;
      let banner_url = editForm.banner_url;
      if (avatarFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: avatarFile });
        avatar_url = file_url;
      }
      if (bannerFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: bannerFile });
        banner_url = file_url;
      }
      const updateData = { bio: editForm.bio, avatar_url, banner_url };
      if (editForm.display_name && editForm.display_name !== currentUser?.display_name) {
        if (!canChangeUsername()) throw new Error("لا يمكنك تغيير الاسم قبل " + daysUntilChange() + " أيام");
        updateData.display_name = editForm.display_name;
        updateData.username_last_changed = new Date().toISOString();
      }
      await base44.auth.updateMe(updateData);

      // Sync the new display name to the author_name on every story the user
      // has published, so credits update across the whole app in real time.
      if (updateData.display_name) {
        try {
          await base44.entities.Story.updateMany(
            { author_email: currentUser.email },
            { $set: { author_name: updateData.display_name } }
          );
        } catch {
          // non-critical — profile still updated
        }
      }
    },
    onSuccess: () => {
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["profile-user"] });
      queryClient.invalidateQueries({ queryKey: ["user-stories"] });
      queryClient.invalidateQueries({ queryKey: ["explore-stories"] });
      toast.success("تم تحديث الملف الشخصي!");
      base44.auth.me().then(setCurrentUser);
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (profileUser) {
      setEditForm({ bio: profileUser.bio || "", avatar_url: profileUser.avatar_url || "", banner_url: profileUser.banner_url || "", display_name: profileUser.display_name || profileUser.full_name || "" });
    }
  }, [profileUser]);

  const totalViews = stories.reduce((sum, s) => sum + (s.views || 0), 0);
  const totalLikes = stories.reduce((sum, s) => sum + (s.likes_count || 0), 0);

  // Unique readers across all the user's authored stories
  const authoredStoryIds = useMemo(() => stories.map(s => s.id), [stories]);
  const { data: totalReaders = 0 } = useQuery({
    queryKey: ["total-readers", authoredStoryIds.join(",")],
    queryFn: async () => {
      if (authoredStoryIds.length === 0) return 0;
      const results = await Promise.all(
        authoredStoryIds.map(sid => base44.entities.ReadingProgress.filter({ story_id: sid }).catch(() => []))
      );
      const emails = new Set();
      results.forEach(progress => progress.forEach(p => p.user_email && emails.add(p.user_email)));
      return emails.size;
    },
    enabled: authoredStoryIds.length > 0,
  });

  if (!profileEmail) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <MobileDetailHeader title={profileUser?.display_name || profileUser?.full_name} fallback="/" className="bg-transparent border-transparent" />
      {/* Banner */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        {profileUser?.banner_url ? (
          <img src={profileUser.banner_url} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-20 relative">
        {/* Avatar + Info */}
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex-shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-background shadow-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              {profileUser?.avatar_url ? (
                <img src={profileUser.avatar_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-3xl font-bold text-white">{profileUser?.full_name?.[0]?.toUpperCase() || "U"}</span>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex-1 pt-2">
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div>
                <h1 className="font-heading text-2xl font-bold">{profileUser?.display_name || profileUser?.full_name || "المستخدم"}</h1>
                {profileUser?.bio && <p className="text-sm mt-2 max-w-lg leading-relaxed">{profileUser.bio}</p>}
              </div>

              <div className="flex gap-2 mt-1">
                {isOwnProfile ? (
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 rounded-full">
                        <Edit className="w-4 h-4" /> تعديل
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="font-heading">تعديل الملف الشخصي</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Banner upload */}
                        <div>
                          <Label>صورة الغلاف (Banner)</Label>
                          <label className="cursor-pointer block mt-1">
                            <div className="relative h-24 rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary transition-colors bg-muted/30">
                              {bannerPreview || editForm.banner_url ? (
                                <img src={bannerPreview || editForm.banner_url} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                                  <Camera className="w-5 h-5" />
                                  <span className="text-sm">رفع غلاف</span>
                                </div>
                              )}
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { setBannerFile(e.target.files[0]); setBannerPreview(URL.createObjectURL(e.target.files[0])); }} />
                          </label>
                        </div>

                        {/* Display name */}
                        <div>
                          <Label>اسم المستخدم</Label>
                          <input
                            value={editForm.display_name}
                            onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                            placeholder="اسمك المعروض..."
                            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                          {canChangeUsername() ? (
                            <p className="text-xs text-muted-foreground mt-1">يمكنك تغيير اسمك مرة كل 5 أيام</p>
                          ) : (
                            <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              يمكنك التغيير بعد {daysUntilChange()} أيام
                            </p>
                          )}
                        </div>

                        {/* Avatar upload */}
                        <div>
                          <Label>صورة الملف الشخصي</Label>
                          <label className="cursor-pointer flex items-center gap-3 mt-1">
                            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary transition-colors bg-muted/30 flex items-center justify-center flex-shrink-0">
                              {avatarPreview || editForm.avatar_url ? (
                                <img src={avatarPreview || editForm.avatar_url} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <Camera className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">انقر لتغيير الصورة</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { setAvatarFile(e.target.files[0]); setAvatarPreview(URL.createObjectURL(e.target.files[0])); }} />
                          </label>
                        </div>

                        <div>
                          <Label>نبذة عنك</Label>
                          <Textarea
                            value={editForm.bio}
                            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                            placeholder="أخبر القراء عن نفسك..."
                            rows={3}
                            className="mt-1"
                          />
                        </div>

                        <Button
                          className="w-full rounded-full"
                          onClick={() => updateProfileMutation.mutate()}
                          disabled={updateProfileMutation.isPending}
                        >
                          {updateProfileMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    className="gap-2 rounded-full"
                    onClick={() => followMutation.mutate()}
                  >
                    <Users className="w-4 h-4" />
                    {isFollowing ? "إلغاء المتابعة" : "متابعة"}
                  </Button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-5 mt-4">
              {[
                { num: stories.length, label: "كتبتها", icon: BookOpen },
                { num: readStories.length, label: "قرأتها", icon: BookMarked },
                { num: followers.length, label: "متابع", icon: Users },
                { num: following.length, label: "يتابع", icon: User },
                { num: totalViews.toLocaleString(), label: "قراءة", icon: Eye },
                { num: totalReaders, label: "قارئ", icon: UserCheck },
                { num: totalLikes, label: "إعجاب", icon: Heart },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="font-bold text-lg">{s.num}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-8">
          <Tabs defaultValue="stories">
            <TabsList className="rounded-full">
              <TabsTrigger value="stories" className="gap-2 rounded-full">
                <BookOpen className="w-4 h-4" /> كتبتها ({stories.length})
              </TabsTrigger>
              <TabsTrigger value="read" className="gap-2 rounded-full">
                <BookMarked className="w-4 h-4" /> قرأتها ({readStories.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="stories" className="mt-6">
              {stories.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                  <PenLine className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground mt-3 text-sm">لم تُنشر أي قصة بعد</p>
                  {isOwnProfile && (
                    <Link to="/write"><Button className="mt-4 rounded-full" size="sm">ابدأ الكتابة</Button></Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {stories.map((story, i) => (
                    <motion.div key={story.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <StoryCard story={story} />
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="read" className="mt-6">
              {readStories.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                  <BookMarked className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground mt-3 text-sm">لم تقرأ أي قصة بعد</p>
                  <Link to="/explore"><Button className="mt-4 rounded-full" size="sm" variant="outline">اكتشف قصصاً</Button></Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {readStories.map((story, i) => (
                    <motion.div key={story.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <StoryCard story={story} />
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}