import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileText,
  Send,
  MessageSquare,
  BarChart3,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  pendingTemplates?: number;
  activeCampaigns?: number;
  apiStatus?: "connected" | "disconnected" | "error";
}

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Templates",
    url: "/templates",
    icon: FileText,
    badge: "pendingTemplates",
  },
  {
    title: "Campaigns",
    url: "/campaigns",
    icon: Send,
    badge: "activeCampaigns",
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
];

const settingsItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar({ 
  pendingTemplates = 0, 
  activeCampaigns = 0,
  apiStatus = "disconnected" 
}: AppSidebarProps) {
  const [location] = useLocation();

  const getBadgeCount = (key: string) => {
    if (key === "pendingTemplates") return pendingTemplates;
    if (key === "activeCampaigns") return activeCampaigns;
    return 0;
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">WhatsApp Broadcast</span>
            <span className="text-xs text-muted-foreground">Enterprise Platform</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = location === item.url;
                const badgeCount = item.badge ? getBadgeCount(item.badge) : 0;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {badgeCount > 0 && (
                          <Badge 
                            variant="secondary" 
                            className="ml-auto h-5 min-w-5 px-1.5 text-xs"
                          >
                            {badgeCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => {
                const isActive = location === item.url;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2 text-xs">
          {apiStatus === "connected" ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-green-500" />
              <span className="text-muted-foreground">Meta API Connected</span>
            </>
          ) : apiStatus === "error" ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
              <span className="text-muted-foreground">Connection Error</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Not Connected</span>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
