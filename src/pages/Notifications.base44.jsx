import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bell, BookOpen, Heart, MessageCircle, Users, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";

const typeIcons = {
  new_chapter: BookOpen,
  new_follower: Users,
  new_comment: MessageCircle,
  new_like: Heart,
  system: Bell,
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin()); }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_email: user.email }, "-created_date", 50),
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  if (!user) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => markAllReadMutation.mutate()}
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="font-heading text-lg font-semibold mt-4">No notifications</p>
          <p className="text-muted-foreground mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const TypeIcon = typeIcons[notif.type] || Bell;
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                  notif.is_read ? "border-border bg-card" : "border-primary/20 bg-primary/5"
                }`}
                onClick={() => !notif.is_read && markReadMutation.mutate(notif.id)}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notif.is_read ? "bg-muted" : "bg-primary/10"
                }`}>
                  <TypeIcon className={`w-4 h-4 ${notif.is_read ? "text-muted-foreground" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notif.is_read ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                    {notif.message}
                  </p>
                  {notif.created_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(notif.created_date), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}