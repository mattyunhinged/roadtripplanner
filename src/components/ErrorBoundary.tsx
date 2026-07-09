import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('On The Road crashed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--bg)] px-6 text-center text-[var(--fg)]">
          <h1 className="font-display text-2xl">Something broke</h1>
          <p className="max-w-md text-sm text-[var(--fg-muted)]">
            {this.state.error.message || 'The app hit an unexpected error while loading.'}
          </p>
          <button
            type="button"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-[var(--accent-fg)]"
            onClick={() => {
              try {
                localStorage.removeItem('otr:chat');
              } catch {
                // ignore
              }
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
