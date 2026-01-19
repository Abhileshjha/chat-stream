import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Send,
  Clock,
  Check,
  CheckCheck,
  MessageSquare,
  User,
  MoreVertical,
  Paperclip,
  Image as ImageIcon,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationMessage } from "@shared/schema";

export default function Inbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages = [] } = useQuery<ConversationMessage[]>({
    queryKey: ["/api/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        content,
        direction: "outbound",
        type: "text",
      });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversation, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("PATCH", `/api/conversations/${conversationId}`, { unreadCount: 0 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const filteredConversations = conversations.filter((c) =>
    c.contactPhone.includes(searchQuery) || c.contactName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  const handleSelectConversation = (convId: string) => {
    setSelectedConversation(convId);
    const conv = conversations.find((c) => c.id === convId);
    if (conv && conv.unreadCount > 0) {
      markReadMutation.mutate(convId);
    }
  };

  const handleSendMessage = () => {
    if (!selectedConversation || !newMessage.trim()) return;
    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      content: newMessage.trim(),
    });
  };

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {totalUnread > 0 ? `${totalUnread} unread messages` : "No unread messages"}
          </p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <Card className="w-80 flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-conversations"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No conversations</div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={cn(
                      "w-full p-3 text-left hover-elevate flex gap-3",
                      selectedConversation === conv.id && "bg-accent"
                    )}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {conv.contactName ? conv.contactName[0].toUpperCase() : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate text-sm">
                          {conv.contactName || conv.contactPhone}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage || "No messages"}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="flex-1 flex flex-col">
          {selectedConversation && selectedConv ? (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {selectedConv.contactName ? selectedConv.contactName[0].toUpperCase() : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{selectedConv.contactName || selectedConv.contactPhone}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedConv.windowEndsAt && new Date(selectedConv.windowEndsAt) > new Date() ? (
                        <span className="text-green-600">24h window active</span>
                      ) : (
                        <span className="text-yellow-600">Template only</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" data-testid="button-conversation-menu">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-xs">Start the conversation by sending a message</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.direction === "outbound" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            msg.direction === "outbound"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            <span className="text-xs">{formatTime(msg.sentAt)}</span>
                            {msg.direction === "outbound" && getStatusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-attach-file">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-attach-image">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-10 resize-none"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className="shrink-0"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a conversation from the list to view messages</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
