import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@carbon/react';

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  public override state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application render failed.', error, info.componentStack);
  }

  public override render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <h1>Control Tower could not load</h1>
          <p>The interface encountered an unexpected error. Reload to try again.</p>
          <Button
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload application
          </Button>
        </main>
      );
    }
    return this.props.children;
  }
}
