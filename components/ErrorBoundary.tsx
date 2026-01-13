import React, { Component, ErrorInfo, ReactNode } from 'react';
import { loggingService } from '../services/loggingService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    loggingService.error(`React Error: ${error.message}`, {
      componentStack: errorInfo.componentStack,
      stack: error.stack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-[#0a0a0c] text-white">
          <div className="text-center p-8">
            <h2 className="text-2xl font-black mb-4">Something went wrong</h2>
            <p className="text-slate-400 mb-6">
              An unexpected error occurred. Please refresh the application.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold uppercase tracking-widest transition-colors"
            >
              Refresh Application
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-slate-500">Error Details</summary>
                <pre className="mt-2 p-4 bg-black/40 rounded text-xs overflow-auto max-h-64">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
