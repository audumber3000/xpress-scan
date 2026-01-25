import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import "./Mail.css";
import { 
  Mail as MailIcon, 
  Send, 
  Inbox, 
  Star, 
  Trash2, 
  RefreshCw, 
  Search,
  Plus,
  X,
  Paperclip,
  ChevronLeft,
  Edit3,
  ChevronRight
} from "lucide-react";

const Mail = () => {
  const { user } = useAuth();
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolder, setCurrentFolder] = useState("inbox");
  
  // Compose email state
  const [composeData, setComposeData] = useState({
    to: "",
    subject: "",
    body: ""
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [patients, setPatients] = useState([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [filteredPatients, setFilteredPatients] = useState([]);

  useEffect(() => {
    checkGmailConnection();
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await api.get("/patients");
      setPatients(response);
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  // Re-check connection when returning to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkGmailConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const checkGmailConnection = async () => {
    try {
      const response = await api.get("/gmail/status");
      setIsGmailConnected(response.connected);
      if (response.connected) {
        fetchEmails();
      }
    } catch (error) {
      console.error("Error checking Gmail connection:", error);
      setIsGmailConnected(false);
    }
  };

  const handleGmailLogin = async () => {
    try {
      const response = await api.get("/gmail/auth-url");
      window.location.href = response.auth_url;
    } catch (error) {
      console.error("Error initiating Gmail login:", error);
      alert("Failed to initiate Gmail login. Please try again.");
    }
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/gmail/messages?folder=${currentFolder}&max_results=50`);
      setEmails(response.messages || []);
    } catch (error) {
      console.error("Error fetching emails:", error);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = async (emailId) => {
    try {
      const response = await api.get(`/gmail/messages/${emailId}`);
      setSelectedEmail(response);
    } catch (error) {
      console.error("Error fetching email details:", error);
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      await api.post("/gmail/send", composeData);
      setShowCompose(false);
      setComposeData({ to: "", subject: "", body: "" });
      setToastMessage("Email sent successfully!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error("Error sending email:", error);
      setToastMessage("Failed to send email. Please try again.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePatientSearch = (query) => {
    setComposeData({ ...composeData, to: query });
    if (query.length > 0) {
      const filtered = patients.filter(patient => 
        patient.name.toLowerCase().includes(query.toLowerCase()) ||
        patient.email?.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredPatients(filtered);
      setShowPatientDropdown(true);
    } else {
      setShowPatientDropdown(false);
    }
  };

  const selectPatient = (patient) => {
    setComposeData({ ...composeData, to: patient.email || patient.name });
    setShowPatientDropdown(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (!isGmailConnected) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <MailIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Connect Your Gmail</h2>
          <p className="text-gray-600 mb-6">
            Sign in with your Google account to read and send emails directly from Clino Health.
          </p>
          <button
            onClick={handleGmailLogin}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/gmail_logo.png" 
              alt="Gmail" 
              className="w-24 h-8"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setCurrentFolder("inbox")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentFolder === "inbox"
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Inbox className="w-5 h-5" />
              <span>Inbox</span>
            </button>
            
            <button
              onClick={() => setCurrentFolder("starred")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentFolder === "starred"
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Star className="w-5 h-5" />
              <span>Starred</span>
            </button>
            
            <button
              onClick={() => setCurrentFolder("sent")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentFolder === "sent"
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Send className="w-5 h-5" />
              <span>Sent</span>
            </button>
            
            <button
              onClick={() => setCurrentFolder("trash")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentFolder === "trash"
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Trash2 className="w-5 h-5" />
              <span>Trash</span>
            </button>
          </nav>
        </div>

        {/* Email List */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-96 bg-white border-r border-gray-200 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <MailIcon className="w-16 h-16 mb-4 text-gray-300" />
                <p>No emails found</p>
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => handleEmailClick(email.id)}
                  className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedEmail?.id === email.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className={`font-bold text-gray-900 ${email.unread ? "text-blue-600" : ""}`}>
                      {email.from}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(email.date)}</span>
                  </div>
                  <div className={`font-bold text-sm mb-1 ${email.unread ? "text-gray-900" : "text-black"}`}>
                    {email.subject}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {email.snippet}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Email Detail */}
          <div className="flex-1 bg-white overflow-y-auto">
            {selectedEmail ? (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedEmail.subject}</h2>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-medium text-gray-900">{selectedEmail.from}</div>
                      <div className="text-sm text-gray-600">to {selectedEmail.to}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(selectedEmail.date).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div 
                  className="prose max-w-none email-content"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body }} 
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <MailIcon className="w-16 h-16 mb-4 text-gray-300 mx-auto" />
                  <p>Select an email to read</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gmail-style Compose Button */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 px-5 py-3 z-40"
      >
        <Edit3 className="w-5 h-5" />
        <span className="font-medium">Compose</span>
      </button>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 flex items-end justify-end z-50">
          <div className="bg-white rounded-t-lg shadow-xl w-full max-w-lg h-[70vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-900">New Message</h3>
              <button
                onClick={() => setShowCompose(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="email"
                    value={composeData.to}
                    onChange={(e) => handlePatientSearch(e.target.value)}
                    onFocus={() => composeData.to.length > 0 && setShowPatientDropdown(true)}
                    placeholder="Recipients (search patients...)"
                    className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                  />
                  
                  {/* Patient Dropdown */}
                  {showPatientDropdown && filteredPatients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                      {filteredPatients.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => selectPatient(patient)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{patient.name}</div>
                          {patient.email && (
                            <div className="text-sm text-gray-600">{patient.email}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    value={composeData.subject}
                    onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                    placeholder="Subject"
                    className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <textarea
                    value={composeData.body}
                    onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                    placeholder="Compose email"
                    className="w-full h-full px-3 py-2 border-none focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-4 border-t border-gray-200">
              <button className="text-gray-600 hover:text-gray-800 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sendingEmail ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default Mail;
