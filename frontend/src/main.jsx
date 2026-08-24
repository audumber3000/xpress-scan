import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'
import ErrorBoundary from './analytics/ErrorBoundary'

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

if (POSTHOG_API_KEY) {
  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: true,
    capture_exceptions: true,   // PostHog error tracking (replaces Sentry)
    // Surveys are enabled by default and render from the PostHog UI — no per-survey code.
    // cross_subdomain_cookie defaults to true — DO NOT disable it. It is what
    // carries a visitor's anonymous id over from www.molarplus.com, so their
    // pre-signup marketing activity stitches onto this user at identify().
    loaded: (ph) => {
      // Marketing (www) shares this PostHog project and stamps
      // source: 'marketing_site'. Stamp the counterpart here so acquisition
      // funnels can filter each side explicitly, instead of relying on
      // "source is not set" to mean "the app".
      ph.register({ source: 'app' });
    },
  })
}

// DevTools helper to verify PostHog error tracking: window.triggerTestError()
window.triggerTestError = () => {
    throw new Error('PostHog test error from the React frontend');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <PostHogProvider client={posthog}>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </PostHogProvider>
    </HelmetProvider>
  </StrictMode>,
)
