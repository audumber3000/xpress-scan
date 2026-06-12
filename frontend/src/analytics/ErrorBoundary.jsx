import React from 'react';
import posthog from 'posthog-js';

/**
 * Catches React render errors and reports them to PostHog error tracking
 * (replaces Sentry). posthog.init({ capture_exceptions: true }) already catches
 * uncaught errors + unhandled rejections; this also catches errors React would
 * otherwise swallow during render.
 */
class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    try {
      if (posthog && typeof posthog.captureException === 'function') {
        posthog.captureException(error, { react_component_stack: info?.componentStack });
      }
    } catch {
      /* never let error reporting throw */
    }
  }

  render() {
    return this.props.children;
  }
}

export default ErrorBoundary;
