import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Shield, BookOpen, Users, Eye, Heart, Trash2, Check, X, Search, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Admin() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [searchStory, setSearchStory] = useState("");

  useEffect(() => {
    base44.auth.me().then((u) => {
      if (u?.role !== "admin") {
        window.location.href = "/";
        return;
      }
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: stories = [] } = useQuery({
    queryKey: ["admin-stories"],
    queryFn: () => base44.entities.Story.list("-created_date", 100),
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => base44.entities.User.list("-created_date", 100),
    enabled: !!user,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["admin-comments"],
    queryFn: () => base44.entities.Comment.list("-created_date", 50),
    enabled: !!user,
  });

  const deleteStoryMutation = useMutation({
    mutationFn: (id) => base44.entities.Story.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stories"] });
      toast.success("Story deleted");
    },
  });

  const toggleApproveMutation = useMutation({
    mutationFn: ({ id, approved }) => base44.entities.Story.update(id, { is_approved: approved }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stories"] });
      toast.success("Story updated");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id) => base44.entities.Comment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-comments"] });
      toast.success("Comment deleted");
    },
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: ({ id, featured }) => base44.entities.Story.update(id, { is_featured: featured }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stories"] });
      toast.success("Story updated");
    },
  });

  if (!user) return null;

  const filteredStories = stories.filter(s =>
    !searchStory || s.title?.toLowerCase().includes(searchStory.toLowerCase()) ||
    s.author_name?.toLowerCase().includes(searchStory.toLowerCase())
  );

  const totalViews = stories.reduce((sum, s) => sum + (s.views || 0), 0);
  const totalLikes = stories.reduce((sum, s) => sum + (s.likes_count || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage content and users</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="w-6 h-6 text-primary mx-auto" />
            <p className="text-2xl font-bold mt-2">{stories.length}</p>
            <p className="text-xs text-muted-foreground">Stories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-accent mx-auto" />
            <p className="text-2xl font-bold mt-2">{users.length}</p>
            <p className="text-xs text-muted-foreground">Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="w-6 h-6 text-secondary mx-auto" />
            <p className="text-2xl font-bold mt-2">{totalViews.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Views</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Heart className="w-6 h-6 text-destructive mx-auto" />
            <p className="text-2xl font-bold mt-2">{totalLikes.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Likes</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stories">
        <TabsList>
          <TabsTrigger value="stories">Stories</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="stories" className="mt-6">
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search stories..."
                value={searchStory}
                onChange={(e) => setSearchStory(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStories.map((story) => (
                  <TableRow key={story.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{story.title}</TableCell>
                    <TableCell className="text-sm">{story.author_name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{story.genre}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={story.is_approved ? "default" : "destructive"} className="text-xs">
                        {story.is_approved ? "Approved" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>{story.views || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => toggleApproveMutation.mutate({ id: story.id, approved: !story.is_approved })}
                          title={story.is_approved ? "Unapprove" : "Approve"}
                        >
                          {story.is_approved ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (confirm("Delete this story?")) deleteStoryMutation.mutate(story.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-6">
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start justify-between p-4 rounded-xl border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.author_name || "Anonymous"}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.content}</p>
                  {c.created_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(c.created_date), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive flex-shrink-0"
                  onClick={() => deleteCommentMutation.mutate(c.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {u.role || "reader"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.created_date ? format(new Date(u.created_date), "MMM d, yyyy") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}