import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useWebSocket } from "@/hooks/use-websocket";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Templates from "@/pages/templates";
import Campaigns from "@/pages/campaigns";
import Messages from "@/pages/messages";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import Inbox from "@/pages/inbox";
import Contacts from "@/pages/contacts";
import Notifications from "@/pages/notifications";
import { useQuery } from "@tanstack/react-query";
import type { Template, Campaign, DashboardMetrics } from "@shared/schema";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/templates" component={Templates} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/messages" component={Messages} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  // Connect to WebSocket for real-time updates
  const { isConnected } = useWebSocket();

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    refetchInterval: 30000, // Fallback polling every 30 seconds
  });

  const pendingTemplates = templates.filter((t) => t.status === "PENDING").length;
  const activeCampaigns = campaigns.filter((c) => c.status === "running").length;

  const style = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          pendingTemplates={pendingTemplates}
          activeCampaigns={activeCampaigns}
          apiStatus={metrics?.apiStatus || "disconnected"}
        />
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Router />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="whatsapp-broadcast-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
