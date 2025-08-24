import React, { useState } from "react";

const Communication = () => {
  const [activeTab, setActiveTab] = useState("whatsapp");

  const tabs = [
    { id: "whatsapp", label: "WhatsApp", icon: "💬" },
    { id: "sms", label: "SMS", icon: "📱" }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Communication</h1>
        <p className="text-gray-600">Manage patient communications via WhatsApp and SMS</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "whatsapp" && (
          <div>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm p-6">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  WhatsApp Integration
                </h3>
                <p className="text-gray-500">
                  WhatsApp communication features will be implemented here.
                </p>
              </div>
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
    </div>
  );
};

export default Communication;
