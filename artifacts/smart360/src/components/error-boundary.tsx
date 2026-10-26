import React from "react";
import { captureChunkFailure, ChunkFailureScreen, isChunkLoadError, recoverChunk } from "@/lib/chunk-recovery";

interface Props {
  children: React.ReactNode;
  resetKey?: any;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    captureChunkFailure(error);
    return { hasError: true, error };
  }
  componentDidMount() {
    window.addEventListener("s360:chunk-error", this.onChunkError);
  }
  componentWillUnmount() {
    window.removeEventListener("s360:chunk-error", this.onChunkError);
  }
  onChunkError = (event: Event) => {
    this.setState({ hasError: true, error: (event as CustomEvent<Error>).detail });
  };
  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) recoverChunk();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      if (isChunkLoadError(this.state.error)) return <ChunkFailureScreen />;
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-8 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-200 m-4">
          <p>Nekaj je šlo narobe.</p>
          <p className="text-sm mt-2 font-mono opacity-70">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
