import { create } from 'zustand';
import type { AutopilotProgress } from '@/types';

export type Screen =
  | 'keys'
  | 'onboarding'
  | 'planner'
  | 'library'
  | 'settings'
  | 'packing'
  | 'export';

interface UIState {
  screen: Screen;
  themeReady: boolean;
  dayFilter: number | 'all';
  hoveredStopId: string | null;
  selectedStopId: string | null;
  chatOpen: boolean;
  autopilotOpen: boolean;
  manualOpen: boolean;
  mobileSheetExpanded: boolean;
  autopilotProgress: AutopilotProgress | null;
  toast: { message: string; type: 'info' | 'error' | 'success' } | null;
  setScreen: (screen: Screen) => void;
  setDayFilter: (day: number | 'all') => void;
  setHoveredStopId: (id: string | null) => void;
  setSelectedStopId: (id: string | null) => void;
  setChatOpen: (open: boolean) => void;
  setAutopilotOpen: (open: boolean) => void;
  setManualOpen: (open: boolean) => void;
  setMobileSheetExpanded: (open: boolean) => void;
  setAutopilotProgress: (progress: AutopilotProgress | null) => void;
  showToast: (message: string, type?: 'info' | 'error' | 'success') => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  screen: 'keys',
  themeReady: false,
  dayFilter: 'all',
  hoveredStopId: null,
  selectedStopId: null,
  chatOpen: false,
  autopilotOpen: false,
  manualOpen: false,
  mobileSheetExpanded: false,
  autopilotProgress: null,
  toast: null,

  setScreen: (screen) => set({ screen }),
  setDayFilter: (dayFilter) => set({ dayFilter }),
  setHoveredStopId: (hoveredStopId) => set({ hoveredStopId }),
  setSelectedStopId: (selectedStopId) => set({ selectedStopId }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setAutopilotOpen: (autopilotOpen) => set({ autopilotOpen }),
  setManualOpen: (manualOpen) => set({ manualOpen }),
  setMobileSheetExpanded: (mobileSheetExpanded) => set({ mobileSheetExpanded }),
  setAutopilotProgress: (autopilotProgress) => set({ autopilotProgress }),
  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
}));
