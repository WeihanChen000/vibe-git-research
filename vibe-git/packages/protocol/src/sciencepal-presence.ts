export interface SPConnection {
  channel: "panel" | "connector";
  state: "online" | "offline" | "never";
  status: "ready" | "working" | "error" | "stopped" | "unknown";
  lastSeen: string | null;
  reason: string;
}
export interface SPMemberPresence { panel: SPConnection; connector: SPConnection }
export const SP_HEARTBEAT_TTL_MS = 30_000;
