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
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Templates from "@/pages/templates";
import TemplateEditor from "@/pages/template-editor";
import Messages from "@/pages/messages";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import Inbox from "@/pages/inbox";
import Contacts from "@/pages/contacts";
import ContactsLists from "@/pages/contacts-lists";
import ContactsTags from "@/pages/contacts-tags";
import ContactsImport from "@/pages/contacts-import";
import Notifications from "@/pages/notifications";
import NotificationEditor from "@/pages/notification-editor";
import Landing from "@/pages/landing";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Refund from "@/pages/refund";
import Contact from "@/pages/contact";
import Admin from "@/pages/admin";
import DeleteData from "@/pages/delete-data";
import { useQuery } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import type { Template, Campaign, DashboardMetrics } from "@shared/schema";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/new" component={TemplateEditor} />
      <Route path="/templates/:id/edit" component={TemplateEditor} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/contacts/lists" component={ContactsLists} />
      <Route path="/contacts/tags" component={ContactsTags} />
      <Route path="/contacts/import" component={ContactsImport} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/notifications/new" component={NotificationEditor} />
      <Route path="/notifications/:id/edit" component={NotificationEditor} />
      <Route path="/messages" component={Messages} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/admin" component={Admin} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/refund" component={Refund} />
      <Route path="/contact" component={Contact} />
      <Route path="/delete-data" component={DeleteData} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/refund" component={Refund} />
      <Route path="/contact" component={Contact} />
      <Route path="/delete-data" component={DeleteData} />
      <Route component={Landing} />
    </Switch>
  );
}

function AuthenticatedApp() {
  useWebSocket();

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    staleTime: 1000 * 60,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    staleTime: 1000 * 60,
  });

  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    refetchInterval: 30000,
    staleTime: 1000 * 30,
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
            <AppRouter />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <PublicRouter />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" storageKey="whatsapp-broadcast-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
