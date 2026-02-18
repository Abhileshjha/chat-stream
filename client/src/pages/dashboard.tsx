import { useQuery } from "@tanstack/react-query";
import { 
  Send, 
  CheckCircle, 
  Eye, 
  XCircle, 
  FileText, 
  TrendingUp,
  DollarSign,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { ActivityFeed } from "@/components/activity-feed";
import { ProgressRing } from "@/components/progress-ring";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardMetrics, ActivityItem, Campaign } from "@shared/schema";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: chartData } = useQuery<{ messageVolume: any[]; statusDistribution: any[] }>({
    queryKey: ["/api/dashboard/chart-data"],
  });

  const { data: activities = [] } = useQuery<ActivityItem[]>({
    queryKey: ["/api/dashboard/activities"],
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const activeCampaigns = campaigns.filter(c => c.status === "running");

  if (metricsLoading) {
    return <DashboardSkeleton />;
  }

  const dashboardMetrics: DashboardMetrics = metrics || {
    totalMessages: 0,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    deliveryRate: 0,
    readRate: 0,
    totalCost: 0,
    activeCampaigns: 0,
    approvedTemplates: 0,
    pendingTemplates: 0,
    messagingLimit: 0,
    messagingUsed: 0,
    qualityRating: "UNKNOWN",
    apiStatus: "disconnected",
  };

  const messageVolume = chartData?.messageVolume || [];
  const statusDist = (chartData?.statusDistribution || []).map((s: any, i: number) => ({
    ...s,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const limitPercent = dashboardMetrics.messagingLimit > 0
    ? (dashboardMetrics.messagingUsed / dashboardMetrics.messagingLimit) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time overview of your messaging performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Quality Rating:</span>
          <StatusBadge status={dashboardMetrics.qualityRating} type="quality" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Messages Sent"
          value={dashboardMetrics.sentCount}
          icon={Send}
          isLive
        />
        <MetricCard
          title="Delivered"
          value={dashboardMetrics.deliveredCount}
          subtitle={`${dashboardMetrics.deliveryRate.toFixed(1)}% delivery rate`}
          icon={CheckCircle}
        />
        <MetricCard
          title="Read"
          value={dashboardMetrics.readCount}
          subtitle={`${dashboardMetrics.readRate.toFixed(1)}% read rate`}
          icon={Eye}
        />
        <MetricCard
          title="Failed"
          value={dashboardMetrics.failedCount}
          subtitle="Requires attention"
          icon={XCircle}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Active Campaigns"
          value={dashboardMetrics.activeCampaigns}
          icon={Activity}
        />
        <MetricCard
          title="Approved Templates"
          value={dashboardMetrics.approvedTemplates}
          subtitle={`${dashboardMetrics.pendingTemplates} pending approval`}
          icon={FileText}
        />
        <MetricCard
          title="Total Cost"
          value={`$${dashboardMetrics.totalCost.toFixed(2)}`}
          subtitle="This billing period"
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Message Volume</CardTitle>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardHeader>
          <CardContent className="pt-0">
            {messageVolume.length > 0 ? (
              <>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={messageVolume} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }} 
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          fontSize: 12
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sent"
                        stroke="hsl(var(--chart-2))"
                        fill="url(#sentGradient)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="delivered"
                        stroke="hsl(var(--chart-1))"
                        fill="url(#deliveredGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                    <span className="text-xs text-muted-foreground">Sent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                    <span className="text-xs text-muted-foreground">Delivered</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No message data in the last 24 hours</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Status Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">All messages</p>
          </CardHeader>
          <CardContent className="pt-0">
            {statusDist.length > 0 ? (
              <>
                <div className="h-52 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusDist.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          fontSize: 12
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {statusDist.map((item: any) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div 
                        className="h-2.5 w-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: item.color }} 
                      />
                      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                      <span className="text-xs font-medium ml-auto tabular-nums">{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No messages yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activeCampaigns.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No active campaigns</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeCampaigns.slice(0, 3).map((campaign) => {
                  const total = campaign.recipients?.length || 0;
                  const progress = 0;
                  return (
                    <div 
                      key={campaign.id}
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card"
                      data-testid={`campaign-card-${campaign.id}`}
                    >
                      <ProgressRing progress={progress} size={60} strokeWidth={6} showLabel={false} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium truncate">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Template: {campaign.templateId}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <StatusBadge status="running" type="campaign" size="sm" />
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {total.toLocaleString()} recipients
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <ActivityFeed 
          activities={activities}
          maxHeight="h-72"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold">Messaging Limits</CardTitle>
            <span className="text-xs text-muted-foreground">Synced from Meta API</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm flex-wrap gap-1">
              <span className="text-muted-foreground">24-hour messaging limit</span>
              <span className="font-medium tabular-nums">
                {dashboardMetrics.messagingUsed.toLocaleString()} / {dashboardMetrics.messagingLimit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(limitPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {limitPercent.toFixed(1)}% of daily limit used
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
