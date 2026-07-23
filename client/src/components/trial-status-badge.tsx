import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface SubscriptionStatus {
  subscriptionStatus: string;
  hasPaid: boolean;
  grantedFreeAccess: boolean;
  trialEndsAt: string | null;
  isActive: boolean;
}

// Always-visible upgrade nudge in the app header - shown from day one of the
// trial, not just once it's about to expire, so upgrading is never more than
// one click away.
export function TrialStatusBadge() {
  const { data: status } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    staleTime: 1000 * 60,
  });

  if (!status || status.grantedFreeAccess || (status.hasPaid && status.subscriptionStatus === "active")) {
    return null;
  }

  const daysLeft = status.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const label =
    status.subscriptionStatus === "trial" && daysLeft > 0
      ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in trial`
      : "Trial ended";

  return (
    <Link href="/billing">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
        data-testid="button-trial-upgrade"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label} · </span>
        Upgrade
      </Button>
    </Link>
  );
}
