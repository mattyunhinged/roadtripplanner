import { useEffect } from 'react';
import { KeySetupScreen } from '@/components/KeySetupScreen';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { PlannerScreen } from '@/components/PlannerScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { LibraryScreen } from '@/components/LibraryScreen';
import { PackingScreen } from '@/components/PackingScreen';
import { ExportScreen } from '@/components/ExportScreen';
import { ToastHost } from '@/components/ui';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useChatStore } from '@/stores/chatStore';
import { useUIStore } from '@/stores/uiStore';

export default function App() {
  const keys = useKeysStore((s) => s.keys);
  const ready = useKeysStore((s) => s.ready);
  const settings = useKeysStore((s) => s.settings);
  const hydrateKeys = useKeysStore((s) => s.hydrate);
  const profile = useProfileStore((s) => s.profile);
  const hydrateProfile = useProfileStore((s) => s.hydrate);
  const hydrateTrips = useTripStore((s) => s.hydrate);
  const hydrateChat = useChatStore((s) => s.hydrate);
  const screen = useUIStore((s) => s.screen);
  const setScreen = useUIStore((s) => s.setScreen);

  useEffect(() => {
    hydrateKeys();
    hydrateProfile();
    hydrateTrips();
    hydrateChat();
  }, [hydrateKeys, hydrateProfile, hydrateTrips, hydrateChat]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  useEffect(() => {
    if (!ready) return;
    if (!keys) {
      setScreen('keys');
      return;
    }
    if (!profile.onboardingComplete) {
      setScreen('onboarding');
      return;
    }
    if (screen === 'keys' || screen === 'onboarding') {
      setScreen('planner');
    }
  }, [ready, keys, profile.onboardingComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg)] text-[var(--fg-muted)]">
        Loading On The Road…
      </div>
    );
  }

  return (
    <div className="h-full">
      {screen === 'keys' && <KeySetupScreen />}
      {screen === 'onboarding' && <OnboardingScreen />}
      {screen === 'planner' && <PlannerScreen />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'library' && <LibraryScreen />}
      {screen === 'packing' && <PackingScreen />}
      {screen === 'export' && <ExportScreen />}
      <ToastHost />
    </div>
  );
}
