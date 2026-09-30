import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import { captureGuestInstallPrompt } from './pages/guest/guest-install';

// Capture the one-shot event before guest data requests and lazy routes mount.
captureGuestInstallPrompt();

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

document.documentElement.dataset.smart360Mounted = '1';
