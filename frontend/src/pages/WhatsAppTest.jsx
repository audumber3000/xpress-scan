import React, { useState, useEffect, useRef } from "react";
import GearLoader from "../components/GearLoader";
import { toast } from "react-toastify";
import { api } from "../utils/api";

const WhatsAppTest = () => {
  const [status, setStatus] = useState("disconnected");
  const [qrCode, setQrCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Send message form
  const [sendPhone, setSendPhone] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  const pollingIntervalRef = useRef(null);

  // Initialize WhatsApp session
  const initializeSession = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post("/whatsapp/inbox/initialize");
      
      if (response.status === "ready") {
        setStatus("ready");
        setQrCode(null);
        setPhoneNumber(response.phone_number);
        setError(null);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        toast.success("WhatsApp is ready!");
      } else if (response.status === "qr_ready") {
        setStatus("qr_ready");
        setQrCode(response.qr_code);
        setError(null);
        startPolling();
        toast.info("QR code generated. Scan with your phone.");
      } else if (response.status === "connecting") {
        setStatus("connecting");
        setError(null);
        startPolling();
      } else if (response.status === "error") {
        setStatus("error");
        setError(response.error || "Failed to initialize WhatsApp");
        setQrCode(null);
        toast.error(response.error || "Failed to initialize");
      }
    } catch (err) {
      let errorMsg = err.response?.data?.detail || err.message || "Failed to initialize WhatsApp";
      setStatus("error");
      setError(errorMsg);
      setQrCode(null);
      toast.error(errorMsg);
      console.error("Initialize error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll for status updates
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await api.get("/whatsapp/inbox/status");
        
        if (response.status === "ready") {
          setStatus("ready");
          setQrCode(null);
          setPhoneNumber(response.phone_number);
          setError(null);
          clearInterval(pollingIntervalRef.current);
          toast.success("WhatsApp connected successfully!");
        } else if (response.status === "qr_ready" && response.qr_code) {
          setStatus("qr_ready");
          setQrCode(response.qr_code);
          setError(null);
        } else if (response.status === "error") {
          setStatus("error");
          setError(response.error || "An error occurred");
          clearInterval(pollingIntervalRef.current);
        }
      } catch (err) {
        console.error("Status polling error:", err);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await api.get("/whatsapp/inbox/status");
        if (response.status === "ready") {
          setStatus("ready");
          setPhoneNumber(response.phone_number);
          setError(null);
        } else if (response.status === "qr_ready") {
          setStatus("qr_ready");
          setQrCode(response.qr_code);
          startPolling();
        } else if (response.status === "error") {
          setStatus("error");
          setError(response.error);
        }
      } catch (err) {
        console.log("No existing session");
      }
    };

    checkSession();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Disconnect
  const disconnect = async () => {
    try {
      setLoading(true);
      await api.post("/whatsapp/inbox/disconnect");
      setStatus("disconnected");
      setQrCode(null);
      setPhoneNumber(null);
      setError(null);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      toast.success("WhatsApp disconnected successfully");
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to disconnect";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!sendPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    
    if (!sendMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (status !== "ready") {
      toast.error("WhatsApp is not ready. Please connect first.");
      return;
    }

    setSending(true);
    setError(null);
    
    try {
      const response = await api.post("/whatsapp/inbox/send-message", {
        phone_number: sendPhone,
        message: sendMessage
      });

      if (response.success) {
        toast.success(`Message sent to ${sendPhone} successfully!`);
        setSendPhone("");
        setSendMessage("");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to send message";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  // Refresh status
  const refreshStatus = async () => {
    try {
      const response = await api.get("/whatsapp/inbox/status");
      if (response.status === "ready") {
        setStatus("ready");
        setPhoneNumber(response.phone_number);
        setQrCode(null);
        setError(null);
      } else if (response.status === "qr_ready") {
        setStatus("qr_ready");
        setQrCode(response.qr_code);
        setError(null);
        if (!pollingIntervalRef.current) {
          startPolling();
        }
      } else if (response.status === "error") {
        setStatus("error");
        setError(response.error);
      } else {
        setStatus(response.status || "disconnected");
      }
      toast.info("Status refreshed");
    } catch (err) {
      console.error("Refresh error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">WhatsApp QR Scanner Test</h1>
              <p className="text-gray-600">Test page for WhatsApp Web integration</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={refreshStatus}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              {status === "ready" ? (
                <button
                  onClick={disconnect}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={initializeSession}
                  disabled={loading}
                  className="px-4 py-2 bg-[#6C4CF3] text-white rounded-lg hover:bg-[#5b3dd9] transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <GearLoader size="w-4 h-4" className="text-white" />
                      Initializing...
                    </>
                  ) : (
                    "Connect WhatsApp"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connection Status</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${
                status === "ready" ? "bg-green-500" :
                status === "qr_ready" ? "bg-yellow-500" :
                status === "connecting" ? "bg-blue-500" :
                status === "error" ? "bg-red-500" :
                "bg-gray-400"
              }`}></div>
              <span className="font-medium text-gray-900">Status: </span>
              <span className={`font-semibold ${
                status === "ready" ? "text-green-600" :
                status === "qr_ready" ? "text-yellow-600" :
                status === "connecting" ? "text-blue-600" :
                status === "error" ? "text-red-600" :
                "text-gray-600"
              }`}>
                {status.toUpperCase()}
              </span>
            </div>
            {phoneNumber && (
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">Phone: </span>
                <span className="text-gray-700">{phoneNumber}</span>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <span className="font-medium">Error: </span>
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* QR Code Scanner */}
        {status === "qr_ready" && qrCode && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">Scan QR Code</h2>
            <div className="flex flex-col items-center">
              <div className="bg-white p-6 rounded-lg border-2 border-gray-300 shadow-lg mb-4">
                <img 
                  src={qrCode} 
                  alt="WhatsApp QR Code" 
                  className="w-80 h-80"
                />
              </div>
              <div className="text-center space-y-2">
                <p className="text-gray-700 font-medium">Instructions:</p>
                <ol className="text-sm text-gray-600 space-y-1 text-left max-w-md">
                  <li>1. Open WhatsApp on your phone</li>
                  <li>2. Go to Settings → Linked Devices</li>
                  <li>3. Tap "Link a Device"</li>
                  <li>4. Scan this QR code</li>
                </ol>
                <p className="text-xs text-gray-500 mt-4">
                  This page will automatically update when you scan the QR code
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connecting State */}
        {status === "connecting" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
            <div className="text-center">
              <GearLoader size="w-16 h-16" className="mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecting...</h2>
              <p className="text-gray-600">Initializing WhatsApp Web. Please wait...</p>
            </div>
          </div>
        )}

        {/* Ready State */}
        {status === "ready" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">WhatsApp Connected!</h2>
              {phoneNumber && (
                <p className="text-gray-600">Connected as: <span className="font-medium">{phoneNumber}</span></p>
              )}
            </div>

            {/* Send Message Form */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Test Message</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number (with country code)
                  </label>
                  <input
                    type="text"
                    value={sendPhone}
                    onChange={(e) => setSendPhone(e.target.value)}
                    placeholder="e.g., 919876543210 or +91 9876543210"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter number with country code (e.g., 91 for India)
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    placeholder="Type your test message here..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                  />
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={sending || !sendPhone.trim() || !sendMessage.trim()}
                  className="w-full px-6 py-3 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <GearLoader size="w-5 h-5" className="text-white" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Disconnected State */}
        {status === "disconnected" && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Connected</h2>
              <p className="text-gray-600 mb-6">Click "Connect WhatsApp" to start</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppTest;







