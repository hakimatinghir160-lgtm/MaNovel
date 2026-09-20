import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import StoryCard from "../components/stories/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Favorites() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["my-favorites", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .eq("user_email", user.email);

      if (error) throw error;

      return data || [];
    },
    enabled: !!user?.email && isAuthenticated,
  });

  const { data: stories = [], isLoading: loadingStories } = useQuery({
    queryKey: [
      "favorite-stories",
      favorites.map((f) => f.story_id).join(","),
    ],
    queryFn: async () => {
      if (favorites.length === 0) return [];

      const storyIds = favorites.map((f) => f.story_id);

      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .in("id", storyIds);

      if (error) throw error;

      return data || [];
    },
    enabled: favorites.length > 0,
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <Bookmark className="w-12 h-12 text-muted-foreground mx-auto" />

        <h3 className="font-heading text-lg font-semibold mt-4">
          سجّل دخولك أولاً
        </h3>

        <p className="text-muted-foreground mt-1">
          سجّل الدخول لمشاهدة القصص المحفوظة
        </p>

        <button
          onClick={() => navigateToLogin()}
          className="mt-5 px-5 py-2 rounded-full bg-primary text-primary-foreground"
        >
          تسجيل الدخول
        </button>
      </div>
    );
  }

  const loading = isLoading || loadingStories;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold flex items-center gap-3">
          <Bookmark className="w-8 h-8 text-primary" />
          My Favorites
        </h1>

        <p className="text-muted-foreground mt-2">
          Stories you've saved for later
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark className="w-12 h-12 text-muted-foreground mx-auto" />

          <h3 className="font-heading text-lg font-semibold mt-4">
            No favorites yet
          </h3>

          <p className="text-muted-foreground mt-1">
            Save stories you love to find them here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  );
}