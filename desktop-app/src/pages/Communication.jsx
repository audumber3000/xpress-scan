import React, { useState, useEffect } from "react";

const Communication = () => {
  const [activeTab, setActiveTab] = useState("whatsapp");

  const tabs = [
    { 
      id: "whatsapp", 
      label: "WhatsApp", 
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      )
    },
    { 
      id: "sms", 
      label: "SMS", 
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/>
        </svg>
      )
    }
  ];

  // Initial automated messages
  const [automatedMessages, setAutomatedMessages] = useState([
    {
      id: 1,
      title: "Festival Greetings",
      icon: "🎉",
      description: "Send automated festival wishes to your patients during special occasions",
      enabled: false,
      message: "Happy Diwali! 🪔 Wishing you and your family a joyous and prosperous festival season. - Team Better Clinic"
    },
    {
      id: 2,
      title: "Report Ready",
      icon: "📄",
      description: "Notify patients when their medical reports are ready for collection",
      enabled: false,
      message: "Hello! Your medical report is now ready. Please visit our clinic or login to your account to view it. For any queries, feel free to contact us."
    },
    {
      id: 3,
      title: "Appointment Reminder",
      icon: "📅",
      description: "Send automatic reminders before scheduled appointments",
      enabled: false,
      message: "Reminder: You have an appointment scheduled tomorrow at {time}. Please arrive 10 minutes early. To reschedule, contact us."
    },
    {
      id: 4,
      title: "Birthday Wishes",
      icon: "🎂",
      description: "Send automated birthday greetings to patients on their special day",
      enabled: false,
      message: "Happy Birthday! 🎉 Wishing you a wonderful day filled with joy and good health. - Team Better Clinic"
    },
    {
      id: 5,
      title: "Follow-up Reminder",
      icon: "🔔",
      description: "Remind patients about their scheduled follow-up visits",
      enabled: false,
      message: "Hi! This is a gentle reminder for your follow-up appointment. Please schedule your visit at your earliest convenience."
    },
    {
      id: 6,
      title: "Payment Receipt",
      icon: "💳",
      description: "Send automated payment confirmation and receipt to patients",
      enabled: false,
      message: "Thank you for your payment! Your receipt has been generated. Amount: ₹{amount}. For any queries, please contact us."
    }
  ]);

  const [selectedMessage, setSelectedMessage] = useState(null);



  const handleToggle = (id) => {
    setAutomatedMessages(automatedMessages.map(msg => 
      msg.id === id ? { ...msg, enabled: !msg.enabled } : msg
    ));
  };

  const handleMessageChange = (id, newMessage) => {
    const updatedMessages = automatedMessages.map(msg => 
      msg.id === id ? { ...msg, message: newMessage } : msg
    );
    setAutomatedMessages(updatedMessages);
    
    // Update the selected message as well
    if (selectedMessage && selectedMessage.id === id) {
      setSelectedMessage({ ...selectedMessage, message: newMessage });
    }
  };

  const handleSave = (id) => {
    // Save functionality - you can add API call here
    alert('Message template saved successfully!');
    setSelectedMessage(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Communication</h1>
          <p className="text-gray-600">Manage automated patient communications via WhatsApp and SMS</p>
        </div>
        
        {/* Communication Icons Banner */}
        <div className="hidden md:flex items-center gap-3">
          {/* WhatsApp Icon */}
          <div className="relative group">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-gray-300"></div>

          {/* SMS Icon */}
          <div className="group">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/>
              </svg>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-gray-300"></div>

          {/* Email Icon */}
          <div className="group">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-gray-300"></div>

          {/* Notification Bell Icon */}
          <div className="relative group">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "whatsapp" && (
          <div>
            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {automatedMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`rounded-xl border shadow-sm hover:shadow-md transition-all p-6 ${
                    msg.enabled 
                      ? 'bg-green-100 border-green-400' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-14 h-14 bg-gradient-to-br from-green-50 to-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">{msg.icon}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{msg.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{msg.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setSelectedMessage(msg)}
                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      Edit Message
                    </button>
                    
                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggle(msg.id)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        msg.enabled ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          msg.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Info Banner at Bottom */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <span className="font-semibold">💡 Tip:</span> Configure automated WhatsApp messages for different occasions. Toggle on to enable and customize your message template.
              </p>
            </div>
          </div>
        )}

        {activeTab === "sms" && (
          <div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm p-6">
              <div className="text-center">
                <div className="text-6xl mb-4">📱</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  SMS Integration
                </h3>
                <p className="text-gray-500">
                  SMS communication features will be implemented here.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Editor Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setSelectedMessage(null)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-50 to-green-100 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">{selectedMessage.icon}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedMessage.title}</h2>
                  <p className="text-sm text-gray-500">{selectedMessage.description}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Message Template
                  </label>
                  <textarea
                    value={selectedMessage.message}
                    onChange={(e) => handleMessageChange(selectedMessage.id, e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 transition-colors resize-none"
                    placeholder="Enter your message template here..."
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    💡 Use <span className="font-mono bg-gray-100 px-1 rounded">{'{time}'}</span>, <span className="font-mono bg-gray-100 px-1 rounded">{'{amount}'}</span>, <span className="font-mono bg-gray-100 px-1 rounded">{'{name}'}</span> as placeholders
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">WhatsApp Preview</h4>
                  
                  {/* WhatsApp-style preview */}
                  <div className="bg-[#E5DDD5] rounded-lg p-4">
                    <div className="flex justify-start">
                      <div className="max-w-[280px] bg-[#DCF8C6] rounded-lg rounded-tl-none shadow-sm">
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-[15px] text-gray-900 leading-[1.4] whitespace-pre-wrap break-words">
                            {selectedMessage.message}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[11px] text-gray-600">
                              {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                            <svg className="w-4 h-4 text-blue-500" viewBox="0 0 16 15" fill="currentColor">
                              <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="mt-2 text-xs text-gray-500 italic">
                    * This is how your message will appear to patients on WhatsApp
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(selectedMessage.id)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Communication;
