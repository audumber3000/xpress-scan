import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'

Sentry.init({
  dsn: "https://73dc9b005c9ed724147ad1f0e119ba48@o4511180469043200.ingest.de.sentry.io/4511180473630800",
  integrations: [],
})

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

if (POSTHOG_API_KEY) {
  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: true,
  })
}

// Attach a test function to the window to trigger a Sentry error easily from the DevTools console
window.triggerSentryError = () => {
    throw new Error('Sentry test error from the React frontend');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <PostHogProvider client={posthog}>
        <App />
      </PostHogProvider>
    </HelmetProvider>
  </StrictMode>,
)
