import { Component, type ErrorInfo, type ReactNode } from "react";

export interface SceneBoundaryProps {
  children: ReactNode;
  /** Receives a reset callback so the fallback can offer a retry. */
  fallback: (retry: () => void) => ReactNode;
}

interface SceneBoundaryState {
  failed: boolean;
}

/**
 * Keeps a failed GLB load (or a lost WebGL context) from blanking the page:
 * R3F rethrows errors caught inside the canvas into the DOM tree, so this
 * boundary can swap the viewport for a readable message.
 */
export class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("[body-map] anatomy scene failed:", error.message, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ failed: false });
  };

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}
