import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Uncaught Error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="mb-4 size-10 text-destructive" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            {this.props.fallbackMessage || this.state.error?.message || "An unexpected error occurred in this view."}
          </p>
          <Button onClick={this.handleReset} variant="outline" className="mt-6">
            <RefreshCw className="mr-2 size-4" /> Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
