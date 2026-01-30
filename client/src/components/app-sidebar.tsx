import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  Send,
  MessageSquare,
  BarChart3,
  Settings,
  Wifi,
  WifiOff,
  Users,
  Bell,
  Inbox,
  ChevronDown,
  ChevronRight,
  Plus,
  Check,
  List,
  Tag,
  Upload,
  Shield,
  Eye,
  EyeOff,
  Smartphone,
} from "lucide-react";

declare global {
  interface Window {
    FB: any;
    __FB_APP_ID__: string;
  }
}
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { WhatsAppAccount, Conversation } from "@shared/schema";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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
    title: "Inbox",
    url: "/inbox",
    icon: Inbox,
    badge: "unreadMessages",
  },
  {
    title: "Templates",
    url: "/templates",
    icon: FileText,
    badge: "pendingTemplates",
  },
];

const contactsSubItems = [
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Lists", url: "/contacts/lists", icon: List },
  { title: "Tags", url: "/contacts/tags", icon: Tag },
  { title: "Import / Export", url: "/contacts/import", icon: Upload },
];

const notificationsSubItems = [
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Add New", url: "/notifications/new", icon: Plus },
];

const bottomNavItems = [
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
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(location.startsWith("/contacts"));
  const [notificationsOpen, setNotificationsOpen] = useState(location.startsWith("/notifications"));
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualAccount, setManualAccount] = useState({
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
    name: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isSuperAdmin = user?.role === "super_admin";

  const { data: accountsData } = useQuery<{ accounts: WhatsAppAccount[]; activeAccountId: string }>({
    queryKey: ["/api/accounts"],
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const switchAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      await apiRequest("PUT", `/api/accounts/${accountId}/active`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
  });

  const accounts = accountsData?.accounts || [];
  const activeAccount = accounts.find(a => a.id === accountsData?.activeAccountId);
  const unreadMessages = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const getBadgeCount = (key: string) => {
    if (key === "pendingTemplates") return pendingTemplates;
    if (key === "activeCampaigns") return activeCampaigns;
    if (key === "unreadMessages") return unreadMessages;
    return 0;
  };

  // Fetch Facebook App ID for SDK initialization
  const { data: fbConfig } = useQuery<{ appId: string }>({
    queryKey: ["/api/auth/facebook/config"],
  });

  // Set the FB App ID for the SDK when config is loaded
  useEffect(() => {
    if (fbConfig?.appId) {
      window.__FB_APP_ID__ = fbConfig.appId;
      // Reinitialize FB SDK if it's already loaded
      if (window.FB) {
        window.FB.init({
          appId: fbConfig.appId,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
      }
    }
  }, [fbConfig?.appId]);

  // Mutation to process the embedded signup response
  const processEmbeddedSignupMutation = useMutation({
    mutationFn: async (data: { accessToken: string; userId: string }) => {
      return apiRequest("POST", "/api/auth/facebook/embedded-signup", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setAddAccountOpen(false);
      toast({
        title: "Account Connected",
        description: "Your WhatsApp Business account has been connected successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Error",
        description: error.message || "Failed to connect WhatsApp Business account.",
        variant: "destructive",
      });
    },
  });

  const addManualAccountMutation = useMutation({
    mutationFn: async (data: typeof manualAccount) => {
      return apiRequest("POST", "/api/whatsapp-accounts/manual", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({
        title: "Account Connected",
        description: data.message || "WhatsApp account connected successfully!",
      });
      setManualAccount({
        phoneNumberId: "",
        businessAccountId: "",
        accessToken: "",
        name: "",
      });
      setAddAccountOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect WhatsApp account. Please check your credentials.",
        variant: "destructive",
      });
    },
  });

  const handleFacebookLogin = async () => {
    if (!fbConfig?.appId) {
      toast({
        title: "Configuration Required",
        description: "Facebook App credentials are not configured. Please contact the administrator.",
        variant: "destructive",
      });
      return;
    }

    if (!window.FB) {
      toast({
        title: "Loading",
        description: "Facebook SDK is still loading. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    
    try {
      // Use Meta's Embedded Signup flow
      // Note: business_management scope is required to access /me/businesses endpoint
      window.FB.login(
        (response: any) => {
          console.log("Embedded signup response:", response);
          
          if (response.authResponse) {
            // Successfully authenticated - send to backend
            processEmbeddedSignupMutation.mutate({
              accessToken: response.authResponse.accessToken,
              userId: response.authResponse.userID,
            });
          } else {
            toast({
              title: "Login Cancelled",
              description: "Facebook login was cancelled or failed.",
              variant: "destructive",
            });
          }
          setIsConnecting(false);
        },
        {
          scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
          extras: {
            feature: 'whatsapp_embedded_signup'
          }
        }
      );
    } catch (error) {
      console.error("Facebook login error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to initiate Facebook login. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 hover-elevate text-left" data-testid="button-account-switcher">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-sm font-semibold truncate">{activeAccount?.name || "WhatsApp Broadcast"}</span>
                <span className="text-xs text-muted-foreground truncate">{activeAccount?.phoneNumber || "No account"}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {accounts.map((account) => (
              <DropdownMenuItem 
                key={account.id}
                onClick={() => switchAccountMutation.mutate(account.id)}
                className="flex items-center gap-2"
                data-testid={`account-${account.id}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{account.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{account.phoneNumber}</div>
                </div>
                {account.id === accountsData?.activeAccountId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} data-testid="button-add-account">
                  <Plus className="h-4 w-4 mr-2" />
                  Add WhatsApp Number
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Connect WhatsApp Number</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="manual" className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual" data-testid="tab-manual">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Manual Entry
                    </TabsTrigger>
                    <TabsTrigger value="facebook" data-testid="tab-facebook">
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Facebook
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="dialog-phone-number-id">Phone Number ID</Label>
                      <Input
                        id="dialog-phone-number-id"
                        value={manualAccount.phoneNumberId}
                        onChange={(e) => setManualAccount(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                        placeholder="e.g., 123456789012345"
                        className="font-mono text-sm"
                        data-testid="input-dialog-phone-number-id"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dialog-waba-id">WABA ID</Label>
                      <Input
                        id="dialog-waba-id"
                        value={manualAccount.businessAccountId}
                        onChange={(e) => setManualAccount(prev => ({ ...prev, businessAccountId: e.target.value }))}
                        placeholder="e.g., 987654321098765"
                        className="font-mono text-sm"
                        data-testid="input-dialog-waba-id"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dialog-access-token">Permanent Access Token</Label>
                      <div className="relative">
                        <Input
                          id="dialog-access-token"
                          type={showManualToken ? "text" : "password"}
                          value={manualAccount.accessToken}
                          onChange={(e) => setManualAccount(prev => ({ ...prev, accessToken: e.target.value }))}
                          placeholder="Enter your access token"
                          className="pr-10 font-mono text-sm"
                          data-testid="input-dialog-access-token"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowManualToken(!showManualToken)}
                          data-testid="button-toggle-dialog-token"
                        >
                          {showManualToken ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={() => addManualAccountMutation.mutate(manualAccount)}
                      disabled={addManualAccountMutation.isPending || !manualAccount.phoneNumberId || !manualAccount.businessAccountId || !manualAccount.accessToken}
                      className="w-full"
                      data-testid="button-add-manual-account-dialog"
                    >
                      {addManualAccountMutation.isPending ? (
                        <>
                          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add WhatsApp Number
                        </>
                      )}
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="facebook" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Connect using Facebook Embedded Signup flow.
                    </p>
                    <Button 
                      className="w-full" 
                      size="lg" 
                      data-testid="button-facebook-login"
                      onClick={handleFacebookLogin}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      )}
                      {isConnecting ? "Connecting..." : "Login with Facebook"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      You'll be redirected to Facebook to authorize access.
                    </p>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
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
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
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

              <Collapsible open={contactsOpen} onOpenChange={setContactsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={location.startsWith("/contacts")}
                      data-testid="nav-contacts"
                    >
                      <Users className="h-4 w-4" />
                      <span className="flex-1">Contacts</span>
                      {contactsOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {contactsSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === subItem.url}
                            data-testid={`nav-contacts-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <Link href={subItem.url}>
                              <subItem.icon className="h-4 w-4" />
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <Collapsible open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={location.startsWith("/notifications")}
                      data-testid="nav-notifications"
                    >
                      <Bell className="h-4 w-4" />
                      <span className="flex-1">Notifications</span>
                      {notificationsOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {notificationsSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === subItem.url}
                            data-testid={`nav-notifications-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <Link href={subItem.url}>
                              <subItem.icon className="h-4 w-4" />
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {bottomNavItems.map((item) => {
                const isActive = location === item.url;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
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
              
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === "/admin"}
                    data-testid="nav-admin"
                  >
                    <Link href="/admin">
                      <Shield className="h-4 w-4" />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
