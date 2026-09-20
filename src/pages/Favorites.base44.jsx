import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import StoryCard from "../components/stories/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Favorites() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["my-favorites", user?.email],
    queryFn: () => base44.entities.Favorite.filter({ user_email: user.email }),
    enabled: !!user,
  });

  const { data: stories = [], isLoading: loadingStories } = useQuery({
    queryKey: ["favorite-stories", favorites.map(f => f.story_id).join(",")],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const allStories = await Promise.all(
        favorites.map(f => base44.entities.Story.filter({ id: f.story_id }).then(r => r[0]).catch(() => null))
      );
      return allStories.filter(Boolean);
    },
    enabled: favorites.length > 0,
  });

  const loading = isLoading || loadingStories;

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold flex items-center gap-3">
          <Bookmark className="w-8 h-8 text-primary" />
          My Favorites
        </h1>
        <p className="text-muted-foreground mt-2">Stories you've saved for later</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="font-heading text-lg font-semibold mt-4">No favorites yet</h3>
          <p className="text-muted-foreground mt-1">Save stories you love to find them here</p>
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