import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface runtime errors so they don't just show a blank page
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  handleHome = () => {
    if (typeof window !== "undefined") window.location.replace("/");
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full text-center space-y-4 p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold">Terjadi kesalahan</h1>
          <p className="text-sm text-muted-foreground break-words">
            {this.state.error.message || "Halaman tidak dapat dimuat."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Muat Ulang
            </button>
            <button
              onClick={this.handleHome}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary"
            >
              Ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }
}