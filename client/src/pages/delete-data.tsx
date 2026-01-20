import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, MessageSquare, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function DeleteData() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/user/delete-account");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });
      window.location.href = "/api/logout";
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete account. Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  const canDelete = 
    user?.email && 
    confirmEmail.toLowerCase() === user.email.toLowerCase() && 
    confirmText === "DELETE MY ACCOUNT" && 
    acknowledged;

  const handleDelete = () => {
    if (canDelete) {
      deleteAccountMutation.mutate();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold">WhatsApp Broadcast</span>
            </div>
          </Link>
          <Link href={isAuthenticated ? "/settings" : "/"}>
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-4xl font-bold mb-4">Delete Your Data</h1>
        <p className="text-muted-foreground mb-8">
          Request permanent deletion of your account and all associated data.
        </p>

        {!isAuthenticated ? (
          <Card>
            <CardHeader>
              <CardTitle>Login Required</CardTitle>
              <CardDescription>
                You must be logged in to delete your account data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Please log in to your account to request data deletion. If you no longer have access to your account, 
                please contact us at{" "}
                <a href="mailto:support@whatsappbroadcast.com" className="text-primary hover:underline">
                  support@whatsappbroadcast.com
                </a>{" "}
                with your registered email address.
              </p>
              <Link href="/api/login">
                <Button data-testid="button-login">Log In</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6 border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  <CardTitle className="text-destructive">Warning: This Action is Irreversible</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Deleting your account will permanently remove:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Your user profile and account information</li>
                  <li>All WhatsApp Business accounts connected to your profile</li>
                  <li>All contacts, contact lists, and tags</li>
                  <li>All message templates and campaigns</li>
                  <li>All message history and analytics data</li>
                  <li>All conversations and inbox messages</li>
                  <li>All notifications and scheduling data</li>
                </ul>
                <p className="text-muted-foreground font-medium">
                  This action cannot be undone. Your data cannot be recovered after deletion.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Confirm Account Deletion</CardTitle>
                <CardDescription>
                  Please complete the following steps to confirm you want to delete your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="confirm-email">Enter your email address</Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    placeholder={user?.email || "your@email.com"}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    data-testid="input-confirm-email"
                  />
                  <p className="text-sm text-muted-foreground">
                    Confirm by entering: <span className="font-mono">{user?.email}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-text">Type "DELETE MY ACCOUNT" to confirm</Label>
                  <Input
                    id="confirm-text"
                    type="text"
                    placeholder="DELETE MY ACCOUNT"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    data-testid="input-confirm-text"
                  />
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="acknowledge"
                    checked={acknowledged}
                    onCheckedChange={(checked) => setAcknowledged(checked === true)}
                    data-testid="checkbox-acknowledge"
                  />
                  <Label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                    I understand that this action is permanent and all my data will be deleted immediately. 
                    I acknowledge that my subscription will be canceled and I will not receive a refund for 
                    any remaining subscription period.
                  </Label>
                </div>

                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  disabled={!canDelete || deleteAccountMutation.isPending}
                  onClick={handleDelete}
                  data-testid="button-delete-account"
                >
                  {deleteAccountMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting Account...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Permanently Delete My Account
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                If you're having issues with your account or want to discuss alternatives to deletion, 
                please contact our support team at{" "}
                <a href="mailto:support@whatsappbroadcast.com" className="text-primary hover:underline">
                  support@whatsappbroadcast.com
                </a>
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
