import { createContext, useContext } from "react";
import type { SessionInfo } from "./types";
export const SessionContext = createContext<SessionInfo | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Workspace not open");
  return value;
}
