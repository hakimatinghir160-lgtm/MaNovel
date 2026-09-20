import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Search,
  Send,
  UserPlus,
  Check,
  X,
  MessageCircle,
  Users,
  ArrowLeft,
  UserCheck,
  Reply,
  Trash2,
  MoreVertical,
} from "lucide-react";

import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

// ============================================================
// HELPERS
// ============================================================

const normalizeEmail = (email) => {
  return String(email || "").trim().toLowerCase();
};

const convId = (email1, email2) => {
  const a = normalizeEmail(email1);
  const b = normalizeEmail(email2);

  return [a, b].sort().join("__");
};

const isDeletedForUser = (message, currentEmail) => {
  if (!message || !currentEmail) return false;

  if (message.deleted_for_everyone) {
    return false;
  }

  const current = normalizeEmail(currentEmail);
  const sender = normalizeEmail(message.sender_email);
  const receiver = normalizeEmail(message.receiver_email);

  if (sender === current && message.deleted_for_sender) {
    return true;
  }

  if (receiver === current && message.deleted_for_receiver) {
    return true;
  }

  return false;
};

const visibleMessagesForUser = (messages, currentEmail) => {
  return (messages || []).filter(
    (message) => !isDeletedForUser(message, currentEmail)
  );
};

// ============================================================
// COMPONENT
// ============================================================

export default function Social() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("friends");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [activeConv, setActiveConv] = useState(null);
  const [msgText, setMsgText] = useState("");

  const [replyingTo, setReplyingTo] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);

  const messagesEndRef = useRef(null);
  const searchRef = useRef(null);
  const messageInputRef = useRef(null);

  const currentEmail = normalizeEmail(user?.email);

  // ============================================================
  // PROFILES
  // ============================================================

  const {
    data: profiles = [],
  } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*");

      if (error) throw error;

      return data || [];
    },
    enabled: !!user,
  });

  // ============================================================
  // FOLLOWING
  // ============================================================

  const {
    data: following = [],
  } = useQuery({
    queryKey: ["following", currentEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("*")
        .ilike("follower_email", currentEmail);

      if (error) throw error;

      return data || [];
    },
    enabled: !!currentEmail,
  });

  // ============================================================
  // FRIEND REQUESTS RECEIVED
  // ============================================================

  const {
    data: receivedRequests = [],
  } = useQuery({
    queryKey: ["received-friend-requests", currentEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("receiver_email", currentEmail)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data || [];
    },
    enabled: !!currentEmail,
  });

  // ============================================================
  // FRIEND REQUESTS SENT
  // ============================================================

  const {
    data: sentRequests = [],
  } = useQuery({
    queryKey: ["sent-friend-requests", currentEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("sender_email", currentEmail)
        .eq("status", "pending");

      if (error) throw error;

      return data || [];
    },
    enabled: !!currentEmail,
  });

  // ============================================================
  // SEARCH USERS
  // ============================================================

  useEffect(() => {
    const searchUsers = async () => {
      const q = searchQuery.trim();

      if (!q) {
        setSearchResults([]);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(
          `username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`
        )
        .limit(20);

      if (error) {
        console.error("Search users error:", error);
        setSearchResults([]);
        return;
      }

      setSearchResults(
        (data || []).filter(
          (profile) =>
            normalizeEmail(profile.email) !== currentEmail
        )
      );
    };

    const timeout = setTimeout(searchUsers, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, currentEmail]);

  // ============================================================
  // FOLLOWING EMAILS
  // ============================================================

  const followingEmails = useMemo(() => {
    return new Set(
      following.map((item) =>
        normalizeEmail(item.following_email)
      )
    );
  }, [following]);

  // ============================================================
  // ALL MY MESSAGES
  // ============================================================

  const {
    data: allMyMessages = [],
  } = useQuery({
    queryKey: ["my-all-messages", currentEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .ilike("sender_email", currentEmail)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      return visibleMessagesForUser(
        data || [],
        currentEmail
      );
    },
    enabled: !!currentEmail,
    refetchInterval: 2000,
  });

  // ============================================================
  // ALL RECEIVED MESSAGES
  // ============================================================

  const {
    data: allReceivedMessages = [],
  } = useQuery({
    queryKey: ["my-received-messages", currentEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .ilike("receiver_email", currentEmail)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      return visibleMessagesForUser(
        data || [],
        currentEmail
      );
    },
    enabled: !!currentEmail,
    refetchInterval: 2000,
  });

  // ============================================================
  // TOTAL UNREAD
  // ============================================================

  const totalUnreadMessages = useMemo(() => {
    return allReceivedMessages.filter(
      (message) =>
        message.is_read === false &&
        !message.deleted_for_everyone
    ).length;
  }, [allReceivedMessages]);

  // ============================================================
  // CONVERSATIONS
  // ============================================================

  const conversations = useMemo(() => {
    const map = new Map();

    const allMessages = [
      ...allMyMessages,
      ...allReceivedMessages,
    ];

    for (const message of allMessages) {
      const sender = normalizeEmail(message.sender_email);
      const receiver = normalizeEmail(message.receiver_email);

      const otherEmail =
        sender === currentEmail ? receiver : sender;

      if (!otherEmail) continue;

      const existing = map.get(otherEmail);

      if (
        !existing ||
        new Date(message.created_at) >
          new Date(existing.created_at)
      ) {
        map.set(otherEmail, message);
      }
    }

    return Array.from(map.entries())
      .map(([email, lastMessage]) => {
        const unreadCount = allReceivedMessages.filter(
          (message) =>
            normalizeEmail(message.sender_email) === email &&
            message.is_read === false &&
            !message.deleted_for_everyone
        ).length;

        const profile = profiles.find(
          (p) =>
            normalizeEmail(p.email) === email
        );

        return {
          email,
          lastMessage,
          unreadCount,
          profile,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessage.created_at) -
          new Date(a.lastMessage.created_at)
      );
  }, [
    allMyMessages,
    allReceivedMessages,
    currentEmail,
    profiles,
  ]);

  // ============================================================
  // ACTIVE CONVERSATION MESSAGES
  // ============================================================

  const {
    data: messages = [],
    isLoading: messagesLoading,
  } = useQuery({
    queryKey: [
      "conversation-messages",
      currentEmail,
      normalizeEmail(activeConv?.email),
    ],

    queryFn: async () => {
      if (!currentEmail || !activeConv?.email) {
        return [];
      }

      const otherEmail =
        normalizeEmail(activeConv.email);

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_email.ilike.${currentEmail},receiver_email.ilike.${otherEmail}),and(sender_email.ilike.${otherEmail},receiver_email.ilike.${currentEmail})`
        )
        .order("created_at", {
          ascending: true,
        })
        .limit(500);

      if (error) throw error;

      return visibleMessagesForUser(
        data || [],
        currentEmail
      );
    },

    enabled:
      !!currentEmail &&
      !!activeConv?.email,

    refetchInterval: 2000,
  });

  // ============================================================
  // SCROLL
  // ============================================================

  useEffect(() => {
    if (!activeConv) return;

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }, 50);
  }, [messages, activeConv]);

  // ============================================================
  // MARK AS READ
  // ============================================================

  const markConversationAsRead = useCallback(
    async (senderEmail) => {
      if (!currentEmail || !senderEmail) {
        return;
      }

      const normalizedSender =
        normalizeEmail(senderEmail);

      try {
        const {
          data: markedMessages,
          error,
        } = await supabase
          .from("messages")
          .update({
            is_read: true,
          })
          .ilike(
            "sender_email",
            normalizedSender
          )
          .ilike(
            "receiver_email",
            currentEmail
          )
          .eq("is_read", false)
          .select(
            "id,sender_email,receiver_email,is_read"
          );

        console.log(
          "MESSAGES MARKED AS READ:",
          markedMessages
        );

        if (error) {
          console.error(
            "Mark messages as read error:",
            error
          );

          toast.error(
            "تعذر تحديث حالة الرسائل كمقروءة"
          );

          throw error;
        }

        // تحديث المحادثة الحالية مباشرة
        queryClient.setQueryData(
          [
            "conversation-messages",
            currentEmail,
            normalizedSender,
          ],
          (old) => {
            if (!old) return old;

            return old.map((message) => {
              if (
                normalizeEmail(
                  message.sender_email
                ) === normalizedSender &&
                normalizeEmail(
                  message.receiver_email
                ) === currentEmail
              ) {
                return {
                  ...message,
                  is_read: true,
                };
              }

              return message;
            });
          }
        );

        // تحديث الرسائل المستلمة مباشرة
        queryClient.setQueryData(
          [
            "my-received-messages",
            currentEmail,
          ],
          (old) => {
            if (!old) return old;

            return old.map((message) => {
              if (
                normalizeEmail(
                  message.sender_email
                ) === normalizedSender &&
                normalizeEmail(
                  message.receiver_email
                ) === currentEmail
              ) {
                return {
                  ...message,
                  is_read: true,
                };
              }

              return message;
            });
          }
        );

        await queryClient.invalidateQueries({
          queryKey: [
            "my-received-messages",
            currentEmail,
          ],
        });

        await queryClient.invalidateQueries({
          queryKey: [
            "my-all-messages",
            currentEmail,
          ],
        });
      } catch (error) {
        console.error(
          "Mark as read exception:",
          error
        );
      }
    },
    [currentEmail, queryClient]
  );

  // ============================================================
  // OPEN CONVERSATION
  // ============================================================

  const openConversation = async (conversation) => {
    if (!conversation?.email) return;

    setMessageMenuId(null);
    setReplyingTo(null);

    await markConversationAsRead(
      conversation.email
    );

    setActiveConv(conversation);
    setTab("chats");
  };

  // ============================================================
  // FOLLOW
  // ============================================================

  const followMutation = useMutation({
    mutationFn: async (email) => {
      const targetEmail =
        normalizeEmail(email);

      const { error } = await supabase
        .from("follows")
        .insert({
          follower_email: currentEmail,
          following_email: targetEmail,
        });

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "following",
          currentEmail,
        ],
      });

      toast.success("تمت المتابعة");
    },

    onError: (error) => {
      console.error(error);

      toast.error(
        "تعذر متابعة المستخدم"
      );
    },
  });

  // ============================================================
  // UNFOLLOW
  // ============================================================

  const unfollowMutation = useMutation({
    mutationFn: async (email) => {
      const targetEmail =
        normalizeEmail(email);

      const { error } = await supabase
        .from("follows")
        .delete()
        .ilike(
          "follower_email",
          currentEmail
        )
        .ilike(
          "following_email",
          targetEmail
        );

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "following",
          currentEmail,
        ],
      });

      toast.success(
        "تم إلغاء المتابعة"
      );
    },

    onError: (error) => {
      console.error(error);

      toast.error(
        "تعذر إلغاء المتابعة"
      );
    },
  });

  // ============================================================
  // SEND FRIEND REQUEST
  // ============================================================

  const sendFriendRequestMutation =
    useMutation({
      mutationFn: async (receiverEmail) => {
        const normalizedReceiver =
          normalizeEmail(receiverEmail);

        const { error } = await supabase
          .from("friend_requests")
          .insert({
            sender_email: currentEmail,
            receiver_email:
              normalizedReceiver,
            status: "pending",
          });

        if (error) throw error;
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "sent-friend-requests",
            currentEmail,
          ],
        });

        toast.success(
          "تم إرسال طلب الصداقة"
        );
      },

      onError: (error) => {
        console.error(error);

        toast.error(
          "تعذر إرسال طلب الصداقة"
        );
      },
    });

  // ============================================================
  // ACCEPT FRIEND REQUEST
  // ============================================================

  const acceptFriendRequestMutation =
    useMutation({
      mutationFn: async (request) => {
        const { error } = await supabase
          .from("friend_requests")
          .update({
            status: "accepted",
          })
          .eq("id", request.id);

        if (error) throw error;
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "received-friend-requests",
            currentEmail,
          ],
        });

        queryClient.invalidateQueries({
          queryKey: [
            "sent-friend-requests",
            currentEmail,
          ],
        });

        toast.success(
          "تم قبول طلب الصداقة"
        );
      },

      onError: (error) => {
        console.error(error);

        toast.error(
          "تعذر قبول الطلب"
        );
      },
    });

  // ============================================================
  // REJECT FRIEND REQUEST
  // ============================================================

  const rejectFriendRequestMutation =
    useMutation({
      mutationFn: async (request) => {
        const { error } = await supabase
          .from("friend_requests")
          .update({
            status: "rejected",
          })
          .eq("id", request.id);

        if (error) throw error;
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "received-friend-requests",
            currentEmail,
          ],
        });

        toast.success(
          "تم رفض الطلب"
        );
      },

      onError: (error) => {
        console.error(error);

        toast.error(
          "تعذر رفض الطلب"
        );
      },
    });

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  const sendMsgMutation = useMutation({
    mutationFn: async ({
      content,
      receiverEmail,
      conversationId,
      replyToId,
    }) => {
      const { data, error } =
        await supabase
          .from("messages")
          .insert({
            sender_email: currentEmail,
            receiver_email:
              normalizeEmail(receiverEmail),
            content,
            conversation_id:
              conversationId,
            is_read: false,
            reply_to_id:
              replyToId || null,
          })
          .select()
          .single();

      if (error) throw error;

      return data;
    },

    onMutate: async ({
      content,
      receiverEmail,
      conversationId,
      replyToId,
    }) => {
      setMsgText("");
      setReplyingTo(null);

      const tempMessage = {
        id: `temp-${Date.now()}`,
        sender_email: currentEmail,
        receiver_email:
          normalizeEmail(receiverEmail),
        content,
        conversation_id:
          conversationId,
        is_read: false,
        reply_to_id:
          replyToId || null,
        created_at:
          new Date().toISOString(),
        __optimistic: true,
      };

      queryClient.setQueryData(
        [
          "conversation-messages",
          currentEmail,
          normalizeEmail(
            receiverEmail
          ),
        ],
        (old) => [
          ...(old || []),
          tempMessage,
        ]
      );

      return {
        tempMessage,
      };
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          "conversation-messages",
          currentEmail,
          normalizeEmail(
            activeConv?.email
          ),
        ],
      });

      await queryClient.invalidateQueries({
        queryKey: [
          "my-all-messages",
          currentEmail,
        ],
      });

      await queryClient.invalidateQueries({
        queryKey: [
          "my-received-messages",
          currentEmail,
        ],
      });
    },

    onError: (
      error,
      variables,
      context
    ) => {
      console.error(
        "Send message error:",
        error
      );

      toast.error(
        "تعذر إرسال الرسالة"
      );

      queryClient.setQueryData(
        [
          "conversation-messages",
          currentEmail,
          normalizeEmail(
            variables.receiverEmail
          ),
        ],
        (old) =>
          (old || []).filter(
            (message) =>
              message.id !==
              context?.tempMessage?.id
          )
      );
    },
  });

  // ============================================================
  // DELETE MESSAGE
  // ============================================================

  const deleteMessageMutation =
    useMutation({
      mutationFn: async ({
        message,
        mode,
      }) => {
        if (!message?.id) {
          throw new Error(
            "Message ID missing"
          );
        }

        const isMine =
          normalizeEmail(
            message.sender_email
          ) === currentEmail;

        // حذف عندي فقط
        if (mode === "me") {
          const field = isMine
            ? "deleted_for_sender"
            : "deleted_for_receiver";

          const { error } =
            await supabase
              .from("messages")
              .update({
                [field]: true,
              })
              .eq(
                "id",
                message.id
              );

          if (error) throw error;

          return {
            message,
            mode,
            field,
          };
        }

        // حذف لدى الجميع
        if (mode === "everyone") {
          if (!isMine) {
            throw new Error(
              "Only the sender can delete for everyone"
            );
          }

          const { error } =
            await supabase
              .from("messages")
              .update({
                deleted_for_everyone:
                  true,
              })
              .eq(
                "id",
                message.id
              )
              .ilike(
                "sender_email",
                currentEmail
              );

          if (error) throw error;

          return {
            message,
            mode,
            field:
              "deleted_for_everyone",
          };
        }

        throw new Error(
          "Unknown delete mode"
        );
      },

      onSuccess: async ({
        message,
        field,
      }) => {
        setMessageMenuId(null);

        if (
          replyingTo &&
          String(replyingTo.id) ===
            String(message.id)
        ) {
          setReplyingTo(null);
        }

        const updateCache = (old) => {
          if (!old) return old;

          return old
            .map((item) => {
              if (
                String(item.id) !==
                String(message.id)
              ) {
                return item;
              }

              return {
                ...item,
                [field]: true,
              };
            })
            .filter(
              (item) =>
                !isDeletedForUser(
                  item,
                  currentEmail
                )
            );
        };

        queryClient.setQueryData(
          [
            "conversation-messages",
            currentEmail,
            normalizeEmail(
              activeConv?.email
            ),
          ],
          updateCache
        );

        queryClient.setQueryData(
          [
            "my-all-messages",
            currentEmail,
          ],
          updateCache
        );

        queryClient.setQueryData(
          [
            "my-received-messages",
            currentEmail,
          ],
          updateCache
        );

        await queryClient.invalidateQueries({
          queryKey: [
            "conversation-messages",
            currentEmail,
            normalizeEmail(
              activeConv?.email
            ),
          ],
        });

        await queryClient.invalidateQueries({
          queryKey: [
            "my-all-messages",
            currentEmail,
          ],
        });

        await queryClient.invalidateQueries({
          queryKey: [
            "my-received-messages",
            currentEmail,
          ],
        });

        toast.success(
          field ===
            "deleted_for_everyone"
            ? "تم حذف الرسالة لدى الجميع"
            : "تم حذف الرسالة عندك"
        );
      },

      onError: (error) => {
        console.error(
          "Delete message error:",
          error
        );

        if (
          error?.message ===
          "Only the sender can delete for everyone"
        ) {
          toast.error(
            "يمكن للمرسل فقط حذف الرسالة لدى الجميع"
          );
        } else {
          toast.error(
            "تعذر حذف الرسالة. تأكدي من صلاحيات Supabase."
          );
        }

        setMessageMenuId(null);
      },
    });

  // ============================================================
  // SEND HANDLER
  // ============================================================

  const handleSendMessage = () => {
    const content =
      msgText.trim();

    if (
      !content ||
      !activeConv?.email
    ) {
      return;
    }

    sendMsgMutation.mutate({
      content,
      receiverEmail:
        activeConv.email,
      conversationId: convId(
        currentEmail,
        activeConv.email
      ),
      replyToId:
        replyingTo?.id || null,
    });
  };

  // ============================================================
  // REPLY
  // ============================================================

  const handleReply = (message) => {
    setMessageMenuId(null);
    setReplyingTo(message);

    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);
  };

  // ============================================================
  // TIME
  // ============================================================

  const formatMessageTime = (date) => {
    if (!date) return "";

    try {
      return format(
        new Date(date),
        "HH:mm"
      );
    } catch {
      return "";
    }
  };

  // ============================================================
  // PROFILE
  // ============================================================

  const getProfile = (email) => {
    return profiles.find(
      (profile) =>
        normalizeEmail(
          profile.email
        ) ===
        normalizeEmail(email)
    );
  };

  // ============================================================
  // CLOSE SEARCH
  // ============================================================

  useEffect(() => {
    const handleClickOutside = (
      event
    ) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(
          event.target
        )
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // ============================================================
  // ACTIVE CHAT
  // ============================================================

  if (activeConv) {
    const activeProfile =
      activeConv.profile ||
      getProfile(
        activeConv.email
      );

    return (
      <div className="flex h-full min-h-[70vh] flex-col bg-background">

        {/* HEADER */}
        <div className="flex items-center gap-3 border-b bg-background p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setActiveConv(null);
              setReplyingTo(null);
              setMessageMenuId(null);
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Link
            to={`/profile/${encodeURIComponent(
              activeConv.email
            )}`}
            className="flex items-center gap-3"
          >
            <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
              {activeProfile?.avatar_url ? (
                <img
                  src={
                    activeProfile.avatar_url
                  }
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                  {(
                    activeProfile?.display_name ||
                    activeProfile?.username ||
                    activeConv.email ||
                    "U"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <div className="font-semibold">
                {activeProfile?.display_name ||
                  activeProfile?.username ||
                  activeConv.email}
              </div>

              {activeProfile?.username && (
                <div className="text-xs text-muted-foreground">
                  @{activeProfile.username}
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* MESSAGES */}
        <div
          className="flex-1 overflow-y-auto p-4"
          onClick={() =>
            setMessageMenuId(null)
          }
        >
          {messagesLoading ? (
            <div className="flex justify-center py-10 text-sm text-muted-foreground">
              جاري تحميل الرسائل...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground" />

              <p className="font-medium">
                لا توجد رسائل بعد
              </p>

              <p className="text-sm text-muted-foreground">
                ابدأ المحادثة الآن
              </p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              {messages.map(
                (message) => {
                  const isMine =
                    normalizeEmail(
                      message.sender_email
                    ) === currentEmail;

                  const isDeletedEveryone =
                    message.deleted_for_everyone;

                  const replyTarget =
                    messages.find(
                      (item) =>
                        String(item.id) ===
                        String(
                          message.reply_to_id
                        )
                    );

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isMine
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`relative max-w-[82%] sm:max-w-[70%] ${
                          isMine
                            ? "items-end"
                            : "items-start"
                        }`}
                      >

                        {/* ====================================================
                            MENU
                            ظاهر دائما على الهاتف والكمبيوتر
                           ==================================================== */}
                        {!isDeletedEveryone && (
                          <div
                            className={`absolute top-1 z-30 ${
                              isMine
                                ? "-left-11"
                                : "-right-11"
                            }`}
                          >
                            <button
                              type="button"
                              aria-label="خيارات الرسالة"
                              className="flex h-9 w-9 items-center justify-center rounded-full border bg-background shadow-md transition hover:bg-muted active:scale-95"
                              onClick={(event) => {
                                event.stopPropagation();

                                setMessageMenuId(
                                  (current) =>
                                    String(
                                      current
                                    ) ===
                                    String(
                                      message.id
                                    )
                                      ? null
                                      : message.id
                                );
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {String(
                              messageMenuId
                            ) ===
                              String(
                                message.id
                              ) && (
                              <div
                                className={`absolute top-10 z-50 min-w-[190px] rounded-xl border bg-background p-1 shadow-2xl ${
                                  isMine
                                    ? "right-0"
                                    : "left-0"
                                }`}
                                onClick={(event) =>
                                  event.stopPropagation()
                                }
                              >

                                {/* REPLY */}
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-right text-sm transition hover:bg-muted active:bg-muted"
                                  onClick={() =>
                                    handleReply(
                                      message
                                    )
                                  }
                                >
                                  <Reply className="h-4 w-4 shrink-0" />

                                  <span>
                                    الرد
                                  </span>
                                </button>

                                {/* DELETE FOR ME */}
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-right text-sm transition hover:bg-muted active:bg-muted"
                                  onClick={() =>
                                    deleteMessageMutation.mutate(
                                      {
                                        message,
                                        mode: "me",
                                      }
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />

                                  <span>
                                    حذف لدي فقط
                                  </span>
                                </button>

                                {/* DELETE FOR EVERYONE */}
                                {isMine && (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-right text-sm text-red-600 transition hover:bg-red-50 active:bg-red-100 dark:hover:bg-red-950/30"
                                    onClick={() =>
                                      deleteMessageMutation.mutate(
                                        {
                                          message,
                                          mode: "everyone",
                                        }
                                      )
                                    }
                                  >
                                    <Trash2 className="h-4 w-4 shrink-0" />

                                    <span>
                                      حذف لدى الجميع
                                    </span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* BUBBLE */}
                        <div
                          className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                            isDeletedEveryone
                              ? "border bg-muted text-muted-foreground"
                              : isMine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {isDeletedEveryone ? (
                            <div className="flex items-center gap-2 text-sm italic">
                              <Trash2 className="h-4 w-4" />

                              <span>
                                تم حذف هذه الرسالة
                              </span>
                            </div>
                          ) : (
                            <>
                              {/* REPLY TARGET */}
                              {message.reply_to_id && (
                                <div
                                  className={`mb-2 rounded-lg border-l-2 px-3 py-2 text-xs ${
                                    isMine
                                      ? "border-primary-foreground/50 bg-primary-foreground/10"
                                      : "border-foreground/20 bg-background/40"
                                  }`}
                                >
                                  <div className="mb-1 font-semibold opacity-80">
                                    {replyTarget
                                      ? normalizeEmail(
                                          replyTarget.sender_email
                                        ) ===
                                        currentEmail
                                        ? "أنت"
                                        : getProfile(
                                            replyTarget.sender_email
                                          )
                                            ?.display_name ||
                                          getProfile(
                                            replyTarget.sender_email
                                          )
                                            ?.username ||
                                          replyTarget.sender_email
                                      : "رسالة"}
                                  </div>

                                  <div className="line-clamp-2 opacity-75">
                                    {replyTarget
                                      ? replyTarget.deleted_for_everyone
                                        ? "تم حذف هذه الرسالة"
                                        : replyTarget.content
                                      : "الرسالة الأصلية غير متاحة"}
                                  </div>
                                </div>
                              )}

                              <div className="whitespace-pre-wrap break-words text-sm">
                                {message.content}
                              </div>
                            </>
                          )}

                          {/* TIME */}
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              isDeletedEveryone
                                ? "text-muted-foreground"
                                : isMine
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            <span>
                              {formatMessageTime(
                                message.created_at
                              )}
                            </span>

                            {isMine &&
                              !isDeletedEveryone && (
                                <span>
                                  {message.is_read
                                    ? "✓✓"
                                    : "✓"}
                                </span>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* REPLY PREVIEW */}
        {replyingTo && (
          <div className="border-t bg-muted/40 px-4 py-2">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <div className="h-9 w-1 rounded-full bg-primary" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Reply className="h-3.5 w-3.5" />

                  <span>
                    الرد على{" "}
                    {normalizeEmail(
                      replyingTo.sender_email
                    ) === currentEmail
                      ? "رسالتك"
                      : getProfile(
                          replyingTo.sender_email
                        )?.display_name ||
                        getProfile(
                          replyingTo.sender_email
                        )?.username ||
                        "الرسالة"}
                  </span>
                </div>

                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {replyingTo.deleted_for_everyone
                    ? "تم حذف هذه الرسالة"
                    : replyingTo.content}
                </div>
              </div>

              <button
                type="button"
                className="rounded-full p-1 hover:bg-muted"
                onClick={() =>
                  setReplyingTo(null)
                }
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* INPUT */}
        <div className="border-t bg-background p-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Input
              ref={messageInputRef}
              value={msgText}
              onChange={(event) =>
                setMsgText(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                replyingTo
                  ? "اكتب ردك..."
                  : "اكتب رسالة..."
              }
              className="min-h-[44px]"
            />

            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full"
              disabled={
                !msgText.trim() ||
                sendMsgMutation.isPending
              }
              onClick={
                handleSendMessage
              }
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN PAGE
  // ============================================================

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">

      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          المجتمع
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          تواصل مع القراء والكتاب
        </p>
      </div>

      {/* TABS */}
      <div className="mb-6 flex overflow-hidden rounded-xl border bg-background">

        <button
          type="button"
          onClick={() =>
            setTab("friends")
          }
          className={`relative flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
            tab === "friends"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          <Users className="h-4 w-4" />

          <span>
            الأصدقاء
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setTab("chats")
          }
          className={`relative flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
            tab === "chats"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          <MessageCircle className="h-4 w-4" />

          <span>
            الرسائل
          </span>

          {totalUnreadMessages > 0 && (
            <span
              className={`absolute right-3 top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                tab === "chats"
                  ? "bg-white text-red-600"
                  : "bg-red-600 text-white"
              }`}
            >
              {totalUnreadMessages > 99
                ? "99+"
                : totalUnreadMessages}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================
          CHATS
      ======================================================== */}

      {tab === "chats" && (
        <div className="space-y-3">

          {conversations.length === 0 ? (
            <div className="rounded-2xl border bg-background p-10 text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

              <h3 className="font-semibold">
                لا توجد محادثات
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                ابدأ محادثة مع أحد المستخدمين
              </p>
            </div>
          ) : (
            conversations.map(
              (conversation) => {
                const profile =
                  conversation.profile ||
                  getProfile(
                    conversation.email
                  );

                const lastMessage =
                  conversation.lastMessage;

                const isLastMessageMine =
                  normalizeEmail(
                    lastMessage.sender_email
                  ) === currentEmail;

                return (
                  <button
                    type="button"
                    key={
                      conversation.email
                    }
                    onClick={() =>
                      openConversation(
                        conversation
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border bg-background p-3 text-left transition hover:bg-muted/50"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">

                      {profile?.avatar_url ? (
                        <img
                          src={
                            profile.avatar_url
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-semibold">
                          {(
                            profile?.display_name ||
                            profile?.username ||
                            conversation.email ||
                            "U"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}

                      {conversation.unreadCount >
                        0 && (
                        <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-background bg-red-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-2">

                        <div className="truncate font-semibold">
                          {profile?.display_name ||
                            profile?.username ||
                            conversation.email}
                        </div>

                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatMessageTime(
                            lastMessage.created_at
                          )}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2">

                        {isLastMessageMine && (
                          <span className="text-xs text-muted-foreground">
                            {lastMessage.is_read
                              ? "✓✓"
                              : "✓"}
                          </span>
                        )}

                        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {lastMessage.deleted_for_everyone
                            ? "تم حذف هذه الرسالة"
                            : lastMessage.content}
                        </p>

                        {conversation.unreadCount >
                          0 && (
                          <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                            {conversation.unreadCount >
                            99
                              ? "99+"
                              : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              }
            )
          )}
        </div>
      )}

      {/* ========================================================
          FRIENDS
      ======================================================== */}

      {tab === "friends" && (
        <div className="space-y-6">

          {/* SEARCH */}
          <div
            ref={searchRef}
            className="relative"
          >
            <div className="relative">

              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(
                    event.target.value
                  );

                  setShowSearchResults(
                    true
                  );
                }}
                onFocus={() =>
                  setShowSearchResults(
                    true
                  )
                }
                placeholder="ابحث عن مستخدم..."
                className="pl-10"
              />
            </div>

            {/* SEARCH RESULTS */}
            {showSearchResults &&
              searchQuery.trim() &&
              searchResults.length >
                0 && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[400px] overflow-y-auto rounded-2xl border bg-background p-2 shadow-xl">

                  {searchResults.map(
                    (profile) => {
                      const email =
                        normalizeEmail(
                          profile.email
                        );

                      const isFollowing =
                        followingEmails.has(
                          email
                        );

                      const hasSentRequest =
                        sentRequests.some(
                          (request) =>
                            normalizeEmail(
                              request.receiver_email
                            ) === email
                        );

                      const conversation =
                        conversations.find(
                          (item) =>
                            normalizeEmail(
                              item.email
                            ) === email
                        );

                      return (
                        <div
                          key={
                            profile.id ||
                            profile.email
                          }
                          className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted"
                        >

                          <Link
                            to={`/profile/${encodeURIComponent(
                              profile.email
                            )}`}
                            onClick={() =>
                              setShowSearchResults(
                                false
                              )
                            }
                            className="flex min-w-0 flex-1 items-center gap-3"
                          >

                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">

                              {profile.avatar_url ? (
                                <img
                                  src={
                                    profile.avatar_url
                                  }
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center font-semibold">
                                  {(
                                    profile.display_name ||
                                    profile.username ||
                                    profile.email ||
                                    "U"
                                  )
                                    .charAt(
                                      0
                                    )
                                    .toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">

                              <div className="truncate font-semibold">
                                {profile.display_name ||
                                  profile.username ||
                                  profile.email}
                              </div>

                              {profile.username && (
                                <div className="truncate text-xs text-muted-foreground">
                                  @
                                  {
                                    profile.username
                                  }
                                </div>
                              )}
                            </div>
                          </Link>

                          <div className="flex shrink-0 items-center gap-1">

                            {/* MESSAGE */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setShowSearchResults(
                                  false
                                );

                                if (
                                  conversation
                                ) {
                                  openConversation(
                                    conversation
                                  );
                                } else {
                                  openConversation({
                                    email:
                                      profile.email,
                                    profile,
                                  });
                                }
                              }}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>

                            {/* FOLLOW */}
                            {isFollowing ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={
                                  unfollowMutation.isPending
                                }
                                onClick={() =>
                                  unfollowMutation.mutate(
                                    profile.email
                                  )
                                }
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={
                                  followMutation.isPending
                                }
                                onClick={() =>
                                  followMutation.mutate(
                                    profile.email
                                  )
                                }
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            )}

                            {/* FRIEND REQUEST */}
                            {hasSentRequest ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={
                                  sendFriendRequestMutation.isPending
                                }
                                onClick={() =>
                                  sendFriendRequestMutation.mutate(
                                    profile.email
                                  )
                                }
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}

            {showSearchResults &&
              searchQuery.trim() &&
              searchResults.length ===
                0 && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border bg-background p-6 text-center text-sm text-muted-foreground shadow-xl">
                  لا يوجد مستخدم بهذا الاسم
                </div>
              )}
          </div>

          {/* FRIEND REQUESTS */}
          {receivedRequests.length >
            0 && (
            <section>

              <div className="mb-3 flex items-center gap-2">

                <UserPlus className="h-5 w-5" />

                <h2 className="font-semibold">
                  طلبات الصداقة
                </h2>

                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {
                    receivedRequests.length
                  }
                </span>
              </div>

              <div className="space-y-2">

                {receivedRequests.map(
                  (request) => {
                    const profile =
                      getProfile(
                        request.sender_email
                      );

                    return (
                      <div
                        key={request.id}
                        className="flex items-center gap-3 rounded-2xl border bg-background p-3"
                      >

                        <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">

                          {profile?.avatar_url ? (
                            <img
                              src={
                                profile.avatar_url
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-semibold">
                              {(
                                profile?.display_name ||
                                profile?.username ||
                                request.sender_email ||
                                "U"
                              )
                                .charAt(
                                  0
                                )
                                .toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="truncate font-semibold">
                            {profile?.display_name ||
                              profile?.username ||
                              request.sender_email}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            أرسل لك طلب صداقة
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="icon"
                          disabled={
                            acceptFriendRequestMutation.isPending
                          }
                          onClick={() =>
                            acceptFriendRequestMutation.mutate(
                              request
                            )
                          }
                        >
                          <Check className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={
                            rejectFriendRequestMutation.isPending
                          }
                          onClick={() =>
                            rejectFriendRequestMutation.mutate(
                              request
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )}

          {/* FOLLOWING */}
          <section>

            <div className="mb-3 flex items-center gap-2">

              <UserCheck className="h-5 w-5" />

              <h2 className="font-semibold">
                الأشخاص الذين تتابعهم
              </h2>
            </div>

            {following.length ===
            0 ? (
              <div className="rounded-2xl border bg-background p-8 text-center text-sm text-muted-foreground">
                لم تبدأ بمتابعة أي شخص بعد.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">

                {following.map(
                  (follow) => {
                    const profile =
                      getProfile(
                        follow.following_email
                      );

                    return (
                      <div
                        key={
                          follow.id ||
                          follow.following_email
                        }
                        className="flex items-center gap-3 rounded-2xl border bg-background p-3"
                      >

                        <Link
                          to={`/profile/${encodeURIComponent(
                            follow.following_email
                          )}`}
                          className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted"
                        >
                          {profile?.avatar_url ? (
                            <img
                              src={
                                profile.avatar_url
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-semibold">
                              {(
                                profile?.display_name ||
                                profile?.username ||
                                follow.following_email ||
                                "U"
                              )
                                .charAt(
                                  0
                                )
                                .toUpperCase()}
                            </div>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">

                          <Link
                            to={`/profile/${encodeURIComponent(
                              follow.following_email
                            )}`}
                            className="block truncate font-semibold hover:underline"
                          >
                            {profile?.display_name ||
                              profile?.username ||
                              follow.following_email}
                          </Link>

                          {profile?.username && (
                            <div className="truncate text-xs text-muted-foreground">
                              @
                              {
                                profile.username
                              }
                            </div>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const conversation =
                              conversations.find(
                                (item) =>
                                  normalizeEmail(
                                    item.email
                                  ) ===
                                  normalizeEmail(
                                    follow.following_email
                                  )
                              );

                            openConversation(
                              conversation || {
                                email:
                                  follow.following_email,
                                profile,
                              }
                            );
                          }}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}