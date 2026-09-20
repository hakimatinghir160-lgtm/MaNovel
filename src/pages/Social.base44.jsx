import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Send, UserPlus, Check, X, MessageCircle, Users, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

function convId(a, b) {
  return [a, b].sort().join("_");
}

export default function Social() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("friends"); // friends | chats
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [activeConv, setActiveConv] = useState(null); // { email, name }
  const [msgText, setMsgText] = useState("");
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  // Resolve display names by email so members never see each other's emails.
  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-names"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });
  const userMap = useMemo(() => {
    const m = {};
    allUsers.forEach(u => { if (u.email) m[u.email] = u; });
    return m;
  }, [allUsers]);
  const isAdmin = user?.role === "admin";
  const getName = (email) => userMap[email]?.display_name || userMap[email]?.full_name || (isAdmin ? email : "مستخدم");

  // Search users
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    const allUsers = await base44.entities.User.list();
    setSearchResults(allUsers.filter(u =>
      u.email !== user?.email &&
      (u.full_name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase()))
    ).slice(0, 8));
  };

  // Friend requests received
  const { data: receivedRequests = [] } = useQuery({
    queryKey: ["friend-requests-received", user?.email],
    queryFn: () => base44.entities.FriendRequest.filter({ receiver_email: user.email, status: "pending" }),
    enabled: !!user,
  });

  // Friend requests sent
  const { data: sentRequests = [] } = useQuery({
    queryKey: ["friend-requests-sent", user?.email],
    queryFn: () => base44.entities.FriendRequest.filter({ sender_email: user.email }),
    enabled: !!user,
  });

  // Friends (accepted)
  const { data: friendsAsSender = [] } = useQuery({
    queryKey: ["friends-sender", user?.email],
    queryFn: () => base44.entities.FriendRequest.filter({ sender_email: user.email, status: "accepted" }),
    enabled: !!user,
  });
  const { data: friendsAsReceiver = [] } = useQuery({
    queryKey: ["friends-receiver", user?.email],
    queryFn: () => base44.entities.FriendRequest.filter({ receiver_email: user.email, status: "accepted" }),
    enabled: !!user,
  });

  const friends = [
    ...friendsAsSender.map(r => ({ email: r.receiver_email, name: r.receiver_email })),
    ...friendsAsReceiver.map(r => ({ email: r.sender_email, name: r.sender_name || r.sender_email }),),
  ];

  // Messages in active conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", activeConv?.email, user?.email],
    queryFn: () => base44.entities.Message.filter(
      { conversation_id: convId(user.email, activeConv.email) }, "created_date", 100
    ),
    enabled: !!activeConv && !!user,
    refetchInterval: 3000,
  });

  // All my conversations (last messages)
  const { data: allMyMessages = [] } = useQuery({
    queryKey: ["my-all-messages", user?.email],
    queryFn: () => base44.entities.Message.filter({ sender_email: user.email }, "-created_date", 200),
    enabled: !!user && tab === "chats",
  });
  const { data: allReceivedMessages = [] } = useQuery({
    queryKey: ["my-received-messages", user?.email],
    queryFn: () => base44.entities.Message.filter({ receiver_email: user.email }, "-created_date", 200),
    enabled: !!user && tab === "chats",
  });

  const allConvMessages = [...allMyMessages, ...allReceivedMessages];
  const convMap = {};
  allConvMessages.forEach(m => {
    const other = m.sender_email === user?.email ? m.receiver_email : m.sender_email;
    if (!convMap[other] || new Date(m.created_date) > new Date(convMap[other].created_date)) {
      convMap[other] = m;
    }
  });
  const conversations = Object.entries(convMap).map(([email, msg]) => ({ email, lastMsg: msg }));

  const sendRequestMutation = useMutation({
    mutationFn: (targetUser) => base44.entities.FriendRequest.create({
      sender_email: user.email,
      sender_name: user.full_name,
      receiver_email: targetUser.email,
      status: "pending",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests-sent"] });
      toast.success("تم إرسال طلب الصداقة!");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (req) => base44.entities.FriendRequest.update(req.id, { status: "accepted" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests-received"] });
      queryClient.invalidateQueries({ queryKey: ["friends-receiver"] });
      toast.success("تم قبول الطلب!");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (req) => base44.entities.FriendRequest.update(req.id, { status: "rejected" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["friend-requests-received"] }),
  });

  const sendMsgMutation = useMutation({
    mutationFn: () => base44.entities.Message.create({
      sender_email: user.email,
      receiver_email: activeConv.email,
      content: msgText,
      conversation_id: convId(user.email, activeConv.email),
      is_read: false,
    }),
    onMutate: () => {
      const tempMsg = {
        id: `temp_${Date.now()}`,
        sender_email: user.email,
        receiver_email: activeConv.email,
        content: msgText,
        conversation_id: convId(user.email, activeConv.email),
        is_read: false,
        created_date: new Date().toISOString(),
      };
      const key = ["messages", activeConv.email, user.email];
      const prev = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old) => [...(old || []), tempMsg]);
      setMsgText("");
      return { prev, key };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["my-all-messages"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isFriend = (email) => friends.some(f => f.email === email);
  const hasSentRequest = (email) => sentRequests.some(r => r.receiver_email === email && r.status === "pending");

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  // Chat view
  if (activeConv) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
          <button onClick={() => setActiveConv(null)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-white">
            {getName(activeConv.email)[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm">{getName(activeConv.email)}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m) => {
            const isMe = m.sender_email === user.email;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                  {m.content}
                  <div className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                    {m.created_date && format(new Date(m.created_date), "HH:mm")}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pt-3 pb-20 md:pb-3 border-t bg-card flex gap-2">
          <Input
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="اكتب رسالة..."
            className="rounded-full"
            onKeyDown={(e) => { if (e.key === "Enter" && msgText.trim()) sendMsgMutation.mutate(); }}
            dir="auto"
          />
          <Button
            size="icon"
            className="rounded-full flex-shrink-0"
            disabled={!msgText.trim() || sendMsgMutation.isPending}
            onClick={() => sendMsgMutation.mutate()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-2xl mb-6">
        {[
          { id: "friends", label: "الأصدقاء", icon: Users },
          { id: "chats", label: "الرسائل", icon: MessageCircle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "friends" && (
        <div className="space-y-6">
          {/* Search */}
          <div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="ابحث عن مستخدم..."
                className="pr-10 rounded-xl"
                dir="rtl"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 border border-border rounded-2xl overflow-hidden bg-card shadow-lg">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {u.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{u.full_name || "مستخدم"}</p>
                    </div>
                    {isFriend(u.email) ? (
                      <Button size="sm" variant="outline" className="rounded-full gap-1 text-xs" onClick={() => setActiveConv({ email: u.email, name: u.full_name })}>
                        <MessageCircle className="w-3 h-3" /> محادثة
                      </Button>
                    ) : hasSentRequest(u.email) ? (
                      <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted">بانتظار الرد</span>
                    ) : (
                      <Button size="sm" className="rounded-full gap-1 text-xs" onClick={() => sendRequestMutation.mutate(u)}>
                        <UserPlus className="w-3 h-3" /> إضافة
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending requests */}
          {receivedRequests.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3">طلبات الصداقة ({receivedRequests.length})</h3>
              <div className="space-y-2">
                {receivedRequests.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 p-3 rounded-2xl border bg-card">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {getName(req.sender_email)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{getName(req.sender_email)}</p>
                      <p className="text-xs text-muted-foreground">أرسل لك طلب صداقة</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => acceptMutation.mutate(req)} className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 flex items-center justify-center transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => rejectMutation.mutate(req)} className="w-8 h-8 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends list */}
          <div>
            <h3 className="font-semibold text-sm mb-3">أصدقائي ({friends.length})</h3>
            {friends.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">ابحث عن أصدقاء وأضفهم</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <div key={f.email} className="flex items-center gap-3 p-3 rounded-2xl border bg-card hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-sm font-bold">
                      {getName(f.email)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{getName(f.email)}</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full gap-1 text-xs" onClick={() => { setActiveConv(f); setTab("chats"); }}>
                      <MessageCircle className="w-3 h-3" /> رسالة
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "chats" && (
        <div>
          <h3 className="font-semibold text-sm mb-4">المحادثات</h3>
          {conversations.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد محادثات بعد</p>
              <p className="text-xs text-muted-foreground mt-1">أضف أصدقاء وابدأ المحادثة</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.sort((a, b) => new Date(b.lastMsg.created_date) - new Date(a.lastMsg.created_date)).map(({ email, lastMsg }) => {
                const name = getName(email);
                return (
                  <button
                    key={email}
                    onClick={() => setActiveConv({ email, name })}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-colors text-right"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex justify-between items-baseline">
                        <p className="font-semibold text-sm truncate">{name}</p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 mr-2">
                          {lastMsg.created_date && format(new Date(lastMsg.created_date), "HH:mm")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {lastMsg.sender_email === user.email ? "أنت: " : ""}{lastMsg.content}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}