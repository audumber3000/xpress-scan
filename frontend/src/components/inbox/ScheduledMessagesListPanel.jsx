import React, { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";
import GearLoader from "../GearLoader";

const ScheduledMessagesListPanel = ({ isOpen, onClose }) => {
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchScheduledMessages();
    }
  }, [isOpen]);

  const fetchScheduledMessages = async () => {
    setLoading(true);
    try {
      const data = await api.get("/whatsapp/inbox/scheduled-messages/");
      setScheduledMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching scheduled messages:", error);
      toast.error("Failed to load scheduled messages");
      setScheduledMessages([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Scheduled Messages</h2>
            <p className="text-sm text-gray-600 mt-1">View and manage your scheduled messages</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <GearLoader size="w-8 h-8" className="text-[#25D366]" />
            </div>
          ) : scheduledMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No scheduled messages</p>
              <p className="text-sm text-gray-400 mt-2">Schedule a message to see it here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledMessages.map((scheduled) => (
                <div key={scheduled.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(scheduled.scheduled_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {scheduled.recipient_count} recipient{scheduled.recipient_count !== 1 ? 's' : ''}
                        {scheduled.sent_count > 0 && (
                          <span className="ml-2">
                            • {scheduled.sent_count} sent
                          </span>
                        )}
                        {scheduled.failed_count > 0 && (
                          <span className="ml-2 text-red-600">
                            • {scheduled.failed_count} failed
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      scheduled.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      scheduled.status === 'sent' ? 'bg-green-100 text-green-800' :
                      scheduled.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {scheduled.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 line-clamp-3">{scheduled.message}</p>
                  {scheduled.sent_at && (
                    <p className="text-xs text-gray-400 mt-2">
                      Sent at: {new Date(scheduled.sent_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ScheduledMessagesListPanel;



