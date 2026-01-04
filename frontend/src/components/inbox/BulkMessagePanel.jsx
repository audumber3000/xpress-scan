import React, { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";
import GearLoader from "../GearLoader";

const BulkMessagePanel = ({ isOpen, onClose, whatsappStatus }) => {
  const [patients, setPatients] = useState([]);
  const [selectedPatients, setSelectedPatients] = useState(new Set());
  const [step, setStep] = useState('select'); // 'select' | 'compose'
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch patients when panel opens
  useEffect(() => {
    if (isOpen && step === 'select') {
      fetchPatients();
    }
  }, [isOpen, step]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await api.get("/patients/");
      setPatients(Array.isArray(data) ? data.filter(p => p.phone) : []);
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast.error("Failed to load patients");
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    !searchQuery || 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery)
  );

  const handleSelectAll = () => {
    if (selectedPatients.size === filteredPatients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const handleTogglePatient = (patientId) => {
    const newSelected = new Set(selectedPatients);
    if (newSelected.has(patientId)) {
      newSelected.delete(patientId);
    } else {
      newSelected.add(patientId);
    }
    setSelectedPatients(newSelected);
  };

  const handleNext = () => {
    if (selectedPatients.size === 0) {
      toast.error("Please select at least one patient");
      return;
    }
    if (selectedPatients.size > 50) {
      toast.error("Maximum 50 patients allowed per bulk message to avoid WhatsApp restrictions");
      return;
    }
    setStep('compose');
  };

  const handleSend = async () => {
    if (!messageText.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (whatsappStatus !== "ready") {
      toast.error("WhatsApp is not ready. Please connect first.");
      return;
    }

    const selectedPatientList = filteredPatients.filter(p => selectedPatients.has(p.id));
    
    if (selectedPatientList.length === 0) {
      toast.error("Please select at least one patient");
      return;
    }

    setSending(true);
    try {
      const delayBetweenMessages = 12000; // 12 seconds
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedPatientList.length; i++) {
        const patient = selectedPatientList[i];
        try {
          await api.post("/whatsapp/inbox/send-message", {
            phone_number: patient.phone.replace(/\D/g, ''),
            message: messageText
          });
          successCount++;
          
          if ((i + 1) % 5 === 0) {
            toast.info(`Sent ${i + 1}/${selectedPatientList.length} messages...`);
          }
        } catch (error) {
          console.error(`Failed to send to ${patient.name}:`, error);
          failCount++;
        }

        if (i < selectedPatientList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenMessages));
        }
      }

      toast.success(`Bulk message sent! Success: ${successCount}, Failed: ${failCount}`);
      
      // Reset and close
      setStep('select');
      setMessageText('');
      setSelectedPatients(new Set());
      onClose();
    } catch (error) {
      toast.error("Failed to send bulk messages");
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    if (step === 'compose') {
      setStep('select');
      setMessageText('');
    } else {
      onClose();
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
            <h2 className="text-xl font-semibold text-gray-900">Send Bulk Messages</h2>
            <p className="text-sm text-gray-600 mt-1">
              {step === 'select' ? 'Select patients to send messages' : 'Compose your message'}
            </p>
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
        <div className="flex-1 overflow-y-auto">
          {step === 'select' ? (
            <>
              {/* Search */}
              <div className="p-4 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
              </div>

              {/* Select All */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPatients.size === filteredPatients.length && filteredPatients.length > 0}
                    onChange={handleSelectAll}
                    className="w-5 h-5 text-[#25D366] border-gray-300 rounded focus:ring-[#25D366]"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({filteredPatients.length} patients)
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {selectedPatients.size} selected
                  </span>
                </label>
              </div>

              {/* Patient List */}
              <div className="divide-y divide-gray-200">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <GearLoader size="w-8 h-8" className="text-[#25D366]" />
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-gray-500">
                    No patients found
                  </div>
                ) : (
                  filteredPatients.map((patient) => (
                    <label
                      key={patient.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPatients.has(patient.id)}
                        onChange={() => handleTogglePatient(patient.id)}
                        className="w-5 h-5 text-[#25D366] border-gray-300 rounded focus:ring-[#25D366]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.phone}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Sending to <strong>{selectedPatients.size}</strong> patient{selectedPatients.size !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Messages will be sent with a 12-second delay between each to avoid WhatsApp restrictions
                </p>
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message here..."
                className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent resize-none"
                rows={10}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-2">
          <button
            onClick={handleBack}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
          >
            {step === 'compose' ? 'Back' : 'Cancel'}
          </button>
          {step === 'select' ? (
            <button
              onClick={handleNext}
              disabled={selectedPatients.size === 0}
              className="flex-1 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next ({selectedPatients.size} selected)
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!messageText.trim() || sending}
              className="flex-1 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : `Send to ${selectedPatients.size}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default BulkMessagePanel;



