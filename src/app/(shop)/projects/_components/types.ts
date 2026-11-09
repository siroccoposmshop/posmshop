import type { Health, Project } from "@/lib/projects";

/** A project as sent to the browser, with its health and people's names worked out on the server. */
export type ProjectView = Project & { health: Health; kamName: string; smName: string | null; tmName: string | null };

export type Viewer = {
  id: string;
  isAdmin: boolean;
  isSm: boolean;
  /** Which projects the tracker opens on: on trade, off trade or both. */
  defaultTrade?: "on" | "off" | "all";
  /** A TM's own name: the tracker starts filtered to their projects (they can clear it). */
  defaultTm?: string | null;
};
