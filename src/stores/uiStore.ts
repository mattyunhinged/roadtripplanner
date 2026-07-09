import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { AutopilotLogEntry, AutopilotPhase, AutopilotProgress } from '@/types';

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
  tripWizardOpen: boolean;
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
  setTripWizardOpen: (open: boolean) => void;
  setManualOpen: (open: boolean) => void;
  setMobileSheetExpanded: (open: boolean) => void;
  setAutopilotProgress: (progress: AutopilotProgress | null) => void;
  pushAutopilotLog: (
    text: string,
    opts?: { phase?: AutopilotPhase; kind?: AutopilotLogEntry['kind']; step?: string; percent?: number; streamPreview?: string },
  ) => void;
  clearAutopilotProgress: () => void;
  showToast: (message: string, type?: 'info' | 'error' | 'success') => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  screen: 'keys',
  themeReady: false,
  dayFilter: 'all',
  hoveredStopId: null,
  selectedStopId: null,
  chatOpen: false,
  autopilotOpen: false,
  tripWizardOpen: false,
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
  setTripWizardOpen: (tripWizardOpen) => set({ tripWizardOpen }),
  setManualOpen: (manualOpen) => set({ manualOpen }),
  setMobileSheetExpanded: (mobileSheetExpanded) => set({ mobileSheetExpanded }),
  setAutopilotProgress: (autopilotProgress) => set({ autopilotProgress }),

  pushAutopilotLog: (text, opts = {}) => {
    const current = get().autopilotProgress;
    const entry: AutopilotLogEntry = {
      id: uuid(),
      at: Date.now(),
      phase: opts.phase || current?.phase || 'thinking',
      text,
      kind: opts.kind || 'status',
    };
    const log = [...(current?.log || []), entry].slice(-80);
    set({
      autopilotProgress: {
        step: opts.step || current?.step || 'Working',
        detail: text,
        percent: opts.percent ?? current?.percent ?? 0,
        phase: opts.phase || current?.phase || 'thinking',
        log,
        streamPreview: opts.streamPreview ?? current?.streamPreview,
      },
    });
  },

  clearAutopilotProgress: () => set({ autopilotProgress: null }),

  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
}));
