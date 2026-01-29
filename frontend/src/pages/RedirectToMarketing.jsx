import React, { useState, useEffect } from "react";

const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || "https://www.molarplus.com";

export default function RedirectToMarketing() {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = MARKETING_URL;
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You&apos;re on the wrong place
          </h1>
          <p className="text-gray-600">
            This is the MolarPlus app. For the website, features, and pricing, visit our main site.
          </p>
        </div>
        <div className="text-5xl font-bold text-[#2a276e] mb-6 tabular-nums">
          Redirecting in {countdown}…
        </div>
        <p className="text-sm text-gray-500">
          If you are not redirected,{" "}
          <a
            href={MARKETING_URL}
            className="text-[#2a276e] hover:underline font-medium"
          >
            click here
          </a>
          .
        </p>
        <p className="text-sm text-gray-500 mt-4">
          To sign in to the app, go to{" "}
          <a href="/login" className="text-[#2a276e] hover:underline font-medium">
            /login
          </a>
          .
        </p>
      </div>
    </div>
  );
}
