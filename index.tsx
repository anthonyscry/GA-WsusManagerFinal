import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AppProvider } from './src/presentation/providers/AppProvider';
import { loggingService } from './services/loggingService';

// Global error handlers - catch unhandled errors and promise rejections
// These will automatically trigger toast notifications via loggingService.error()
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  loggingService.error(`Unhandled promise rejection: ${message}`, { stack });
});

window.addEventListener('error', (event) => {
  loggingService.error(`Uncaught error: ${event.message}`, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
