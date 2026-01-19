import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MoreVertical,
  Bell,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Users,
  FileText,
  Trash2,
  Play,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm, Controller } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Notification, Template, ContactList } from "@shared/schema";

export default function Notifications() {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: lists = [] } = useQuery<ContactList[]>({
    queryKey: ["/api/lists"],
  });

  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  const createNotificationMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      templateId: string;
      listIds: string[];
      scheduledAt?: string;
    }) => {
      return apiRequest("POST", "/api/notifications", data);
    },
    onSuccess: () => {
      toast({ title: "Notification created successfully" });
      setCreateOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({ title: "Failed to create notification", variant: "destructive" });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Notification deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/notifications/${id}`, { status: "sending" });
    },
    onSuccess: () => {
      toast({ title: "Notification is being sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      templateId: "",
      listIds: [] as string[],
      scheduledAt: "",
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "scheduled":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "sending":
        return <Send className="h-4 w-4 text-blue-500 animate-pulse" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      scheduled: "outline",
      sending: "default",
      completed: "default",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Create and schedule broadcast notifications
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-notification">
              <Plus className="h-4 w-4 mr-2" />
              New Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Notification</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createNotificationMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: "Name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notification Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Weekly Newsletter" {...field} data-testid="input-notification-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="templateId"
                  rules={{ required: "Template is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template">
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {approvedTemplates.length === 0 ? (
                            <SelectItem value="_none" disabled>No approved templates</SelectItem>
                          ) : (
                            approvedTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="listIds"
                  rules={{ validate: (v) => v.length > 0 || "Select at least one list" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Lists</FormLabel>
                      <div className="space-y-2">
                        {lists.map((list) => (
                          <label
                            key={list.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover-elevate",
                              field.value.includes(list.id) && "border-primary bg-primary/5"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={field.value.includes(list.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, list.id]);
                                } else {
                                  field.onChange(field.value.filter((id) => id !== list.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-muted"
                              data-testid={`checkbox-list-${list.id}`}
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{list.name}</div>
                              <div className="text-xs text-muted-foreground">{list.contactCount.toLocaleString()} contacts</div>
                            </div>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule (optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-schedule-time" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Leave empty to save as draft
                      </p>
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1" disabled={createNotificationMutation.isPending} data-testid="button-submit-notification">
                    {createNotificationMutation.isPending ? "Creating..." : "Create Notification"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{notifications.filter((n) => n.status === "draft").length}</p>
                <p className="text-sm text-muted-foreground">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{notifications.filter((n) => n.status === "scheduled").length}</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Send className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{notifications.filter((n) => n.status === "sending").length}</p>
                <p className="text-sm text-muted-foreground">Sending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{notifications.filter((n) => n.status === "completed").length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No notifications yet</p>
                <p className="text-sm">Create your first notification to start broadcasting</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const template = templates.find((t) => t.id === notification.templateId);
                  
                  return (
                    <Card key={notification.id} className="hover-elevate" data-testid={`notification-${notification.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(notification.status)}
                            <div>
                              <h3 className="font-medium">{notification.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                Template: {template?.name || "Unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(notification.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-notification-menu-${notification.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {notification.status === "draft" && (
                                  <DropdownMenuItem onClick={() => sendNotificationMutation.mutate(notification.id)}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Send Now
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteNotificationMutation.mutate(notification.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{notification.totalRecipients.toLocaleString()} recipients</span>
                          </div>
                          {notification.scheduledAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Scheduled for {formatDate(notification.scheduledAt)}</span>
                            </div>
                          )}
                          {notification.status === "completed" && (
                            <div className="flex items-center gap-3">
                              <span className="text-green-600">{notification.deliveredCount} delivered</span>
                              <span className="text-blue-600">{notification.readCount} read</span>
                              {notification.failedCount > 0 && (
                                <span className="text-red-600">{notification.failedCount} failed</span>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
