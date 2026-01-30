import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, XCircle, AlertTriangle, ExternalLink, HelpCircle, ChevronDown, ChevronUp, Copy, Plus, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ApiSettings } from "@shared/schema";

export default function Settings() {
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);
  const { toast } = useToast();

  // Manual account form state
  const [manualAccount, setManualAccount] = useState({
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
    name: "",
  });

  const { data: settings, isLoading } = useQuery<ApiSettings>({
    queryKey: ["/api/settings"],
  });

  const [formData, setFormData] = useState<Partial<ApiSettings>>({
    accessToken: "",
    phoneNumberId: "",
    businessAccountId: "",
    webhookVerifyToken: "",
    apiVersion: "v18.0",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ApiSettings>) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Saved",
        description: "Your API configuration has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/test");
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
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
      // Reset form
      setManualAccount({
        phoneNumberId: "",
        businessAccountId: "",
        accessToken: "",
        name: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect WhatsApp account. Please check your credentials.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof ApiSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your Meta WhatsApp Business API connection
        </p>
      </div>

      {/* Setup Guide */}
      <Collapsible open={showGuide} onOpenChange={setShowGuide}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base font-semibold">Setup Guide</CardTitle>
                    <CardDescription>
                      Step-by-step instructions to connect WhatsApp Business API
                    </CardDescription>
                  </div>
                </div>
                {showGuide ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              <div className="space-y-4">
                <SetupStep
                  step={1}
                  title="Create a Meta Developer Account"
                  description="Go to developers.facebook.com and create a developer account if you don't have one."
                  link="https://developers.facebook.com/"
                />
                <SetupStep
                  step={2}
                  title="Create a Business App"
                  description="Create a new app and select 'Business' as the app type. This will give you access to WhatsApp Business API."
                  link="https://developers.facebook.com/apps/"
                />
                <SetupStep
                  step={3}
                  title="Add WhatsApp Product"
                  description="In your app dashboard, find 'WhatsApp' in the products list and click 'Set Up'. Follow the prompts to link your business account."
                />
                <SetupStep
                  step={4}
                  title="Get Your Credentials"
                  description="Navigate to WhatsApp > API Setup. Here you'll find your Phone Number ID, Business Account ID, and can generate a permanent Access Token."
                />
                <SetupStep
                  step={5}
                  title="Configure Webhook"
                  description="In WhatsApp > Configuration, add the webhook URL shown below and enter your custom verify token. Subscribe to 'messages' events."
                />
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Helpful Resources</p>
                <div className="space-y-2">
                  <ResourceLink
                    text="WhatsApp Cloud API Documentation"
                    url="https://developers.facebook.com/docs/whatsapp/cloud-api"
                  />
                  <ResourceLink
                    text="Get Permanent Access Token"
                    url="https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#1--acquire-an-access-token-using-a-system-user-or-facebook-login"
                  />
                  <ResourceLink
                    text="Message Template Guidelines"
                    url="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines"
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Add WhatsApp Number Manually */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold">Add WhatsApp Number</CardTitle>
              <CardDescription>
                Connect a WhatsApp Business number using your Meta API credentials
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-phone-number-id">Phone Number ID</Label>
            <Input
              id="manual-phone-number-id"
              value={manualAccount.phoneNumberId}
              onChange={(e) => setManualAccount(prev => ({ ...prev, phoneNumberId: e.target.value }))}
              placeholder="e.g., 123456789012345"
              className="font-mono text-sm"
              data-testid="input-manual-phone-number-id"
            />
            <p className="text-xs text-muted-foreground">
              Find this in Meta Business Suite &gt; WhatsApp &gt; API Setup
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-waba-id">WABA ID (Business Account ID)</Label>
            <Input
              id="manual-waba-id"
              value={manualAccount.businessAccountId}
              onChange={(e) => setManualAccount(prev => ({ ...prev, businessAccountId: e.target.value }))}
              placeholder="e.g., 987654321098765"
              className="font-mono text-sm"
              data-testid="input-manual-waba-id"
            />
            <p className="text-xs text-muted-foreground">
              WhatsApp Business Account ID from Meta Business Suite
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-access-token">Permanent Access Token</Label>
            <div className="relative">
              <Input
                id="manual-access-token"
                type={showManualToken ? "text" : "password"}
                value={manualAccount.accessToken}
                onChange={(e) => setManualAccount(prev => ({ ...prev, accessToken: e.target.value }))}
                placeholder="Enter your permanent access token"
                className="pr-10 font-mono text-sm"
                data-testid="input-manual-access-token"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowManualToken(!showManualToken)}
                data-testid="button-toggle-manual-token"
              >
                {showManualToken ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate a permanent System User token from Meta Business Settings
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-name">Account Name (Optional)</Label>
            <Input
              id="manual-name"
              value={manualAccount.name}
              onChange={(e) => setManualAccount(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., My Business WhatsApp"
              className="text-sm"
              data-testid="input-manual-name"
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this account
            </p>
          </div>

          <Button
            onClick={() => addManualAccountMutation.mutate(manualAccount)}
            disabled={addManualAccountMutation.isPending || !manualAccount.phoneNumberId || !manualAccount.businessAccountId || !manualAccount.accessToken}
            className="w-full"
            data-testid="button-add-manual-account"
          >
            {addManualAccountMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Verifying & Connecting...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add WhatsApp Number
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Connection Status</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="button-test-connection"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${testMutation.isPending ? "animate-spin" : ""}`} />
              Test Connection
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <StatusIndicator status={settings ? "connected" : "disconnected"} />
            <div className="flex-1">
              <p className="font-medium">
                {settings ? "Connected to Meta API" : "Not Connected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {settings 
                  ? "Your WhatsApp Business API is configured and operational"
                  : "Configure your API credentials below to connect"
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">API Configuration</CardTitle>
          <CardDescription>
            Enter your Meta WhatsApp Business API credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <div className="relative">
              <Input
                id="accessToken"
                type={showToken ? "text" : "password"}
                value={formData.accessToken}
                onChange={(e) => handleInputChange("accessToken", e.target.value)}
                placeholder="Enter your permanent access token"
                className="pr-10 font-mono text-sm"
                data-testid="input-access-token"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate a permanent token from Meta Business Suite
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID</Label>
              <Input
                id="phoneNumberId"
                value={formData.phoneNumberId}
                onChange={(e) => handleInputChange("phoneNumberId", e.target.value)}
                placeholder="e.g., 123456789012345"
                className="font-mono text-sm"
                data-testid="input-phone-number-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAccountId">Business Account ID</Label>
              <Input
                id="businessAccountId"
                value={formData.businessAccountId}
                onChange={(e) => handleInputChange("businessAccountId", e.target.value)}
                placeholder="e.g., 987654321098765"
                className="font-mono text-sm"
                data-testid="input-business-account-id"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
            <Input
              id="webhookVerifyToken"
              value={formData.webhookVerifyToken}
              onChange={(e) => handleInputChange("webhookVerifyToken", e.target.value)}
              placeholder="Your custom verification token"
              className="font-mono text-sm"
              data-testid="input-webhook-verify-token"
            />
            <p className="text-xs text-muted-foreground">
              A custom string to verify webhook requests from Meta
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiVersion">API Version</Label>
            <Input
              id="apiVersion"
              value={formData.apiVersion}
              onChange={(e) => handleInputChange("apiVersion", e.target.value)}
              placeholder="v18.0"
              className="font-mono text-sm max-w-32"
              data-testid="input-api-version"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setFormData(settings || {})}
            >
              Reset
            </Button>
            <Button 
              onClick={() => saveMutation.mutate(formData)}
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Webhook Configuration</CardTitle>
          <CardDescription>
            Configure webhooks to receive real-time updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex items-center gap-2">
              <Input
                value={`${window.location.origin}/api/webhook`}
                readOnly
                className="font-mono text-sm bg-muted"
              />
              <Button 
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/webhook`);
                  toast({ title: "Copied to clipboard" });
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this URL in your Meta app webhook configuration
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-sm font-medium">Subscribe to Events</p>
            <div className="space-y-3">
              <WebhookToggle
                label="Message Status Updates"
                description="Receive delivery, read, and failure notifications"
                defaultChecked
              />
              <WebhookToggle
                label="Template Status Updates"
                description="Receive approval, rejection, and quality changes"
                defaultChecked
              />
              <WebhookToggle
                label="Account Updates"
                description="Receive quality rating and limit changes"
                defaultChecked
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Rate Limits</CardTitle>
          <CardDescription>
            Current API rate limits and usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Messages per second</p>
                <p className="text-sm text-muted-foreground">Current tier limit</p>
              </div>
              <Badge variant="secondary" className="font-mono">80/sec</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Messages per 24 hours</p>
                <p className="text-sm text-muted-foreground">Based on quality tier</p>
              </div>
              <Badge variant="secondary" className="font-mono">100,000</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Template submissions</p>
                <p className="text-sm text-muted-foreground">Per day</p>
              </div>
              <Badge variant="secondary" className="font-mono">100/day</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatusIndicatorProps {
  status: "connected" | "disconnected" | "error";
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = {
    connected: { 
      icon: CheckCircle, 
      color: "text-green-500", 
      bg: "bg-green-500/10",
      label: "Connected" 
    },
    disconnected: { 
      icon: XCircle, 
      color: "text-muted-foreground", 
      bg: "bg-muted",
      label: "Disconnected" 
    },
    error: { 
      icon: AlertTriangle, 
      color: "text-red-500", 
      bg: "bg-red-500/10",
      label: "Error" 
    },
  };

  const { icon: Icon, color, bg } = config[status];

  return (
    <div className={`p-3 rounded-lg ${bg}`}>
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
  );
}

interface WebhookToggleProps {
  label: string;
  description: string;
  defaultChecked?: boolean;
}

function WebhookToggle({ label, description, defaultChecked }: WebhookToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

interface SetupStepProps {
  step: number;
  title: string;
  description: string;
  link?: string;
}

function SetupStep({ step, title, description, link }: SetupStepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
        {step}
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Open Link
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

interface ResourceLinkProps {
  text: string;
  url: string;
}

function ResourceLink({ text, url }: ResourceLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-primary hover:underline flex items-center gap-1"
    >
      <ExternalLink className="h-3 w-3" />
      {text}
    </a>
  );
}
