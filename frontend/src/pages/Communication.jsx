import React, { useState } from "react";
import Card from "../components/Card";

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
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-white text-green-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "whatsapp" && (
          <Card>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                WhatsApp Integration
              </h3>
              <p className="text-gray-500">
                WhatsApp communication features will be implemented here.
              </p>
            </div>
          </Card>
        )}

        {activeTab === "sms" && (
          <Card>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📱</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                SMS Integration
              </h3>
              <p className="text-gray-500">
                SMS communication features will be implemented here.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Communication;
