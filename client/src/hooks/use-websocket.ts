import { useEffect, useRef, useCallback, useState } from "react";
import { queryClient } from "@/lib/queryClient";

type WebSocketEvent = 
  | "connected"
  | "message-status-update"
  | "template-updated"
  | "campaign-updated"
  | "activity-added"
  | "settings-updated"
  | "metrics-updated";

interface WebSocketMessage {
  event: WebSocketEvent;
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { 
    onMessage, 
    autoReconnect = true, 
    reconnectInterval = 3000 
  } = options;
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    // Build WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          
          // Handle built-in cache invalidation
          handleCacheInvalidation(message);
          
          // Call custom handler if provided
          if (onMessage) {
            onMessage(message);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect
        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      
      // Retry connection
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    }
  }, [onMessage, autoReconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    disconnect,
    reconnect: connect,
  };
}

// Handle automatic cache invalidation based on WebSocket events
function handleCacheInvalidation(message: WebSocketMessage) {
  switch (message.event) {
    case "message-status-update":
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      break;
      
    case "template-updated":
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      break;
      
    case "campaign-updated":
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      break;
      
    case "activity-added":
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      break;
      
    case "settings-updated":
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      break;
      
    case "metrics-updated":
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      break;
      
    default:
      break;
  }
}

// Hook for subscribing to specific WebSocket events
export function useWebSocketEvent(
  eventName: WebSocketEvent,
  callback: (data: any) => void
) {
  const { lastMessage } = useWebSocket();
  
  useEffect(() => {
    if (lastMessage && lastMessage.event === eventName) {
      callback(lastMessage.data);
    }
  }, [lastMessage, eventName, callback]);
}
