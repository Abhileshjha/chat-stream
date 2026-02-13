import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Send, CheckCircle, Eye, XCircle, FileCheck, FileX, Play, Flag } from "lucide-react";
import type { ActivityItem } from "@shared/schema";

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
  maxHeight?: string;
}

const activityConfig: Record<string, { icon: typeof Send; color: string; bg: string }> = {
  message_sent: { icon: Send, color: "text-blue-500", bg: "bg-blue-500/10" },
  message_delivered: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  message_read: { icon: Eye, color: "text-primary", bg: "bg-primary/10" },
  message_failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  template_approved: { icon: FileCheck, color: "text-green-500", bg: "bg-green-500/10" },
  template_rejected: { icon: FileX, color: "text-red-500", bg: "bg-red-500/10" },
  campaign_started: { icon: Play, color: "text-primary", bg: "bg-primary/10" },
  campaign_completed: { icon: Flag, color: "text-green-500", bg: "bg-green-500/10" },
  notification_completed: { icon: Send, color: "text-green-500", bg: "bg-green-500/10" },
  notification_sent: { icon: Send, color: "text-blue-500", bg: "bg-blue-500/10" },
  notification_failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

const defaultActivityConfig = { icon: Flag, color: "text-muted-foreground", bg: "bg-muted" };

export function ActivityFeed({ activities, className, maxHeight = "h-96" }: ActivityFeedProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          <span className="text-xs text-muted-foreground">
            {activities.length} events
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={maxHeight}>
          <div className="px-6 pb-6 space-y-4">
            {activities.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              activities.map((activity) => {
                const config = activityConfig[activity.type] || defaultActivityConfig;
                const Icon = config.icon;
                
                return (
                  <div 
                    key={activity.id} 
                    className="flex gap-3 group"
                    data-testid={`activity-item-${activity.id}`}
                  >
                    <div className={cn(
                      "shrink-0 mt-0.5 p-1.5 rounded-md",
                      config.bg
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium leading-tight">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
