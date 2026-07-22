import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Clock, CreditCard, XCircle } from "lucide-react";

interface SubscriptionStatus {
  subscriptionStatus: string;
  hasPaid: boolean;
  grantedFreeAccess: boolean;
  trialEndsAt: string | null;
  isActive: boolean;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Billing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const { data: status, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
  });

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const daysLeft = status?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const ready = await loadRazorpayScript();
      if (!ready) {
        toast({ title: "Error", description: "Could not load payment gateway. Please try again.", variant: "destructive" });
        return;
      }

      const res = await apiRequest("POST", "/api/subscription/create");
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Error", description: data.error || "Failed to start subscription", variant: "destructive" });
        return;
      }

      const razorpay = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "WhatsApp Broadcast",
        description: "Unlimited Messaging - ₹799/month",
        theme: { color: "#25D366" },
        handler: () => {
          toast({ title: "Payment Successful", description: "Your subscription is being activated - this may take a few seconds." });
          setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] }), 2000);
        },
        modal: {
          ondismiss: () => setIsSubscribing(false),
        },
      });

      razorpay.on("payment.failed", () => {
        toast({ title: "Payment Failed", description: "Your payment could not be processed. Please try again.", variant: "destructive" });
      });

      razorpay.open();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to start subscription", variant: "destructive" });
    } finally {
      setIsSubscribing(false);
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading subscription status...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground">Manage your subscription and payment</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Plan</CardTitle>
            {status?.isActive ? (
              <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>
            ) : (
              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Inactive</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.grantedFreeAccess && (
            <p className="text-sm text-muted-foreground">You have been granted free access by an administrator.</p>
          )}
          {status?.hasPaid && status.subscriptionStatus === "active" && (
            <p className="text-sm text-muted-foreground">You're subscribed - unlimited messaging is active.</p>
          )}
          {status?.subscriptionStatus === "trial" && !status.hasPaid && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span>
                {daysLeft > 0
                  ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial`
                  : "Your free trial has ended"}
              </span>
            </div>
          )}
          {!status?.isActive && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">₹799</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Unlimited WhatsApp broadcast messaging</p>
              <Button onClick={handleSubscribe} disabled={isSubscribing} data-testid="button-subscribe" className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                {isSubscribing ? "Opening payment..." : "Subscribe Now"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
