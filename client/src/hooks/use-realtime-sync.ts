import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

const SYNC_INTERVAL_MS = 8000;

const SYNCED_QUERY_KEYS = [
  ["/api/messages"],
  ["/api/templates"],
  ["/api/campaigns"],
  ["/api/dashboard/metrics"],
  ["/api/dashboard/activities"],
  ["/api/settings"],
];

// Polling-based stand-in for the WebSocket push updates the dashboard used to
// rely on. Hostinger's Cloud/shared Node hosting doesn't reliably proxy
// WebSocket upgrade requests, so instead of a live push we periodically mark
// the shared dashboard queries stale and let TanStack Query refetch anything
// currently mounted. Page-local queries (e.g. Inbox) already poll on their
// own shorter intervals and don't depend on this.
export function useRealtimeSync() {
  useEffect(() => {
    const tick = () => {
      for (const queryKey of SYNCED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    const interval = setInterval(tick, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
}
