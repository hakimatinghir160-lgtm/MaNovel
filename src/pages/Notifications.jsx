import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";

export default function Notifications() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: notifications = [],
    isLoading,
  } = useQuery({
    queryKey: ["my-notifications", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_email", user.email)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return data || [];
    },
    enabled: !!user?.email && isAuthenticated,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["my-notifications", user?.email],
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_email", user.email)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["my-notifications", user?.email],
      });
    },
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <Bell className="w-12 h-12 text-muted-foreground mx-auto" />

        <h3 className="font-heading text-lg font-semibold mt-4">
          سجّل دخولك أولاً
        </h3>

        <p className="text-muted-foreground mt-1">
          سجّل الدخول لمشاهدة الإشعارات
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

  const unread = notifications.filter((notification) => !notification.is_read);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Notifications
          </h1>

          <p className="text-muted-foreground mt-2">
            Stay updated with what's happening
          </p>
        </div>

        {unread.length > 0 && (
          <button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-full border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-muted animate-pulse"
              />
            ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto" />

          <h3 className="font-heading text-lg font-semibold mt-4">
            No notifications yet
          </h3>

          <p className="text-muted-foreground mt-1">
            You'll see your notifications here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-xl border p-4 transition-colors ${
                notification.is_read
                  ? "bg-background"
                  : "bg-primary/5 border-primary/20"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    notification.is_read
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Bell className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {notification.sender_name && (
                        <p className="font-semibold">
                          {notification.sender_name}
                        </p>
                      )}

                      <p className="text-sm mt-1">
                        {notification.message}
                      </p>

                      {notification.created_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(
                            notification.created_at
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {!notification.is_read && (
                      <button
                        onClick={() =>
                          markAsReadMutation.mutate(notification.id)
                        }
                        disabled={markAsReadMutation.isPending}
                        className="shrink-0 p-2 rounded-full hover:bg-muted transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {notification.link && (
                    <a
                      href={notification.link}
                      className="inline-block text-sm text-primary hover:underline mt-2"
                    >
                      View
                    </a>
                  )}
                </div>

                {!notification.is_read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}