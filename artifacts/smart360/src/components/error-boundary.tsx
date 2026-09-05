import React from "react";

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
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
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
