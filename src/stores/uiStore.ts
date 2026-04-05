import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  threadPanelOpen: boolean;
  activeThreadMessageId: string | null;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openThread: (messageId: string) => void;
  closeThread: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  threadPanelOpen: false,
  activeThreadMessageId: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSidebarCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  openThread: (messageId) => set({ threadPanelOpen: true, activeThreadMessageId: messageId }),
  closeThread: () => set({ threadPanelOpen: false, activeThreadMessageId: null }),
}));
