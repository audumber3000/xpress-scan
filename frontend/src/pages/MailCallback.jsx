import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../utils/api";
import { RefreshCw } from "lucide-react";

const MailCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code || !state) {
          setError("Missing authorization code or state");
          setStatus("error");
          return;
        }

        // Send the code to backend to complete OAuth flow
        await api.get(`/gmail/callback?code=${code}&state=${state}`);
        
        setStatus("success");
        
        // Redirect to mail page after 1 second
        setTimeout(() => {
          navigate("/mail");
        }, 1000);
        
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err.message || "Failed to connect Gmail");
        setStatus("error");
        
        // Redirect back to mail page after 3 seconds
        setTimeout(() => {
          navigate("/mail");
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg">
        {status === "processing" && (
          <>
            <RefreshCw className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connecting Gmail...</h2>
            <p className="text-gray-600">Please wait while we complete the authorization.</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Gmail Connected!</h2>
            <p className="text-gray-600">Redirecting to your inbox...</p>
          </>
        )}
        
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connection Failed</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting back to mail page...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default MailCallback;
