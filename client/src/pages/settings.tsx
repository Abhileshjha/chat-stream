import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ApiSettings } from "@shared/schema";

export default function Settings() {
  const [showToken, setShowToken] = useState(false);
  const { toast } = useToast();

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
