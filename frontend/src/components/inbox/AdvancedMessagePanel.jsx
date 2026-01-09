import React, { useState } from "react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";

const AdvancedMessagePanel = ({ onClose, onMessageSent }) => {
  const [activeTab, setActiveTab] = useState("button"); // "button", "list", "contact"
  const [sending, setSending] = useState(false);

  // Common fields
  const [phone, setPhone] = useState("");

  // Button message fields
  const [buttonMessage, setButtonMessage] = useState("");
  const [buttonFooter, setButtonFooter] = useState("");
  const [buttons, setButtons] = useState([{ id: "", body: "" }]);
  const [buttonMedia, setButtonMedia] = useState(null);
  const [buttonMediaPreview, setButtonMediaPreview] = useState(null);

  // List message fields
  const [listTitle, setListTitle] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [listButtonText, setListButtonText] = useState("");
  const [listFooter, setListFooter] = useState("");
  const [sections, setSections] = useState([
    {
      title: "",
      rows: [{ id: "", title: "", description: "" }]
    }
  ]);

  // Contact message fields
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactDisplayName, setContactDisplayName] = useState("");

  const addButton = () => {
    setButtons([...buttons, { id: "", body: "" }]);
  };

  const removeButton = (index) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index, field, value) => {
    const newButtons = [...buttons];
    newButtons[index][field] = value;
    setButtons(newButtons);
  };

  const addSection = () => {
    setSections([
      ...sections,
      {
        title: "",
        rows: [{ id: "", title: "", description: "" }]
      }
    ]);
  };

  const removeSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const updateSection = (sectionIndex, field, value) => {
    const newSections = [...sections];
    newSections[sectionIndex][field] = value;
    setSections(newSections);
  };

  const addRow = (sectionIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].rows.push({ id: "", title: "", description: "" });
    setSections(newSections);
  };

  const removeRow = (sectionIndex, rowIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].rows = newSections[sectionIndex].rows.filter((_, i) => i !== rowIndex);
    setSections(newSections);
  };

  const updateRow = (sectionIndex, rowIndex, field, value) => {
    const newSections = [...sections];
    newSections[sectionIndex].rows[rowIndex][field] = value;
    setSections(newSections);
  };

  const handleButtonMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setButtonMedia(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setButtonMediaPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendButton = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !buttonMessage.trim() || buttons.filter(b => b.id && b.body).length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const validButtons = buttons.filter(b => b.id && b.body);
      const payload = {
        phone: phone,
        message: buttonMessage,
        buttons: validButtons,
        footer: buttonFooter || undefined
      };

      if (buttonMedia) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64String = reader.result.split(",")[1];
          const mediaType = buttonMedia.type || "image/jpeg";
          payload.media = base64String;
          payload.mediaType = mediaType;

          try {
            const response = await api.post("/whatsapp/messages/button", payload);
            console.log("Button message response:", response);
            if (response.data && response.data.success) {
              toast.success("Button message sent successfully!");
              if (onMessageSent) onMessageSent();
            } else {
              const errorMsg = response.data?.error || response.data?.detail || "Failed to send button message";
              toast.error(errorMsg);
              // If it's a deprecation error, suggest using List messages
              if (errorMsg.toLowerCase().includes('deprecated')) {
                toast.info("💡 Tip: Try using List messages instead - they're still supported!");
              }
            }
          } catch (error) {
            console.error("Button message error:", error);
            const errorMsg = error.response?.data?.detail || error.response?.data?.error || error.message || "Failed to send button message";
            toast.error(errorMsg);
            // If it's a deprecation error, suggest using List messages
            if (errorMsg.toLowerCase().includes('deprecated')) {
              toast.info("💡 Tip: Try using List messages instead - they're still supported!");
            }
          } finally {
            setSending(false);
          }
        };
        reader.readAsDataURL(buttonMedia);
      } else {
        try {
          const response = await api.post("/whatsapp/messages/button", payload);
          console.log("Button message response:", response);
          if (response.data && response.data.success) {
            toast.success("Button message sent successfully!");
            if (onMessageSent) onMessageSent();
          } else {
            const errorMsg = response.data?.error || response.data?.detail || "Failed to send button message";
            toast.error(errorMsg);
            // If it's a deprecation error, suggest using List messages
            if (errorMsg.toLowerCase().includes('deprecated')) {
              toast.info("💡 Tip: Try using List messages instead - they're still supported!");
            }
          }
        } catch (error) {
          console.error("Button message error:", error);
          const errorMsg = error.response?.data?.detail || error.response?.data?.error || error.message || "Failed to send button message";
          toast.error(errorMsg);
          // If it's a deprecation error, suggest using List messages
          if (errorMsg.toLowerCase().includes('deprecated')) {
            toast.info("💡 Tip: Try using List messages instead - they're still supported!");
          }
        } finally {
          setSending(false);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send button message");
      console.error(error);
      setSending(false);
    }
  };

  const handleSendList = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !listTitle.trim() || !listButtonText.trim() || sections.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const validSections = sections.map(section => ({
        title: section.title,
        rows: section.rows.filter(r => r.id && r.title).map(r => ({
          id: r.id,
          title: r.title,
          description: r.description || undefined
        }))
      })).filter(s => s.title && s.rows.length > 0);

      const response = await api.post("/whatsapp/messages/list", {
        phone: phone,
        title: listTitle,
        description: listDescription || undefined,
        buttonText: listButtonText,
        sections: validSections,
        footer: listFooter || undefined
      });

      if (response.data && response.data.success) {
        toast.success("List message sent successfully!");
        if (onMessageSent) onMessageSent();
      } else {
        toast.error(response.data?.error || response.data?.detail || "Failed to send list message");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send list message");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleSendContact = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !contactName.trim() || !contactNumber.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const response = await api.post("/whatsapp/messages/contact", {
        phone: phone,
        contact: {
          name: contactName,
          number: contactNumber,
          displayName: contactDisplayName || undefined
        }
      });

      if (response.data && response.data.success) {
        toast.success("Contact message sent successfully!");
        if (onMessageSent) onMessageSent();
      } else {
        toast.error(response.data?.error || response.data?.detail || "Failed to send contact message");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send contact message");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Advanced Messages</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("button")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === "button"
                ? "text-[#25D366] border-b-2 border-[#25D366]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Button Message
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === "list"
                ? "text-[#25D366] border-b-2 border-[#25D366]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            List Message
          </button>
          <button
            onClick={() => setActiveTab("contact")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === "contact"
                ? "text-[#25D366] border-b-2 border-[#25D366]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Contact Message
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Common Phone Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number (with country code) *
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 919876543210"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
              required
            />
          </div>

          {activeTab === "button" && (
            <form onSubmit={handleSendButton} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={buttonMessage}
                  onChange={(e) => setButtonMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Footer (optional)
                </label>
                <input
                  type="text"
                  value={buttonFooter}
                  onChange={(e) => setButtonFooter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Media (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleButtonMediaChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
                {buttonMediaPreview && (
                  <img src={buttonMediaPreview} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buttons * (at least 1, max 3)
                </label>
                {buttons.map((button, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={button.id}
                      onChange={(e) => updateButton(index, "id", e.target.value)}
                      placeholder="Button ID"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={button.body}
                      onChange={(e) => updateButton(index, "body", e.target.value)}
                      placeholder="Button Text"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    {buttons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeButton(index)}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={addButton}
                    className="text-sm text-[#25D366] hover:underline"
                  >
                    + Add Button
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Button Message"}
              </button>
            </form>
          )}

          {activeTab === "list" && (
            <form onSubmit={handleSendList} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Button Text *
                </label>
                <input
                  type="text"
                  value={listButtonText}
                  onChange={(e) => setListButtonText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Footer (optional)
                </label>
                <input
                  type="text"
                  value={listFooter}
                  onChange={(e) => setListFooter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sections *
                </label>
                {sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="mb-4 p-4 border border-gray-300 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(sectionIndex, "title", e.target.value)}
                        placeholder="Section Title"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg mr-2"
                      />
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(sectionIndex)}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          Remove Section
                        </button>
                      )}
                    </div>
                    {section.rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={row.id}
                          onChange={(e) => updateRow(sectionIndex, rowIndex, "id", e.target.value)}
                          placeholder="Row ID"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) => updateRow(sectionIndex, rowIndex, "title", e.target.value)}
                          placeholder="Row Title"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRow(sectionIndex, rowIndex, "description", e.target.value)}
                          placeholder="Row Description"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        />
                        {section.rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(sectionIndex, rowIndex)}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addRow(sectionIndex)}
                      className="text-sm text-[#25D366] hover:underline"
                    >
                      + Add Row
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSection}
                  className="text-sm text-[#25D366] hover:underline"
                >
                  + Add Section
                </button>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send List Message"}
              </button>
            </form>
          )}

          {activeTab === "contact" && (
            <form onSubmit={handleSendContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name *
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number *
                </label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g., 919876543210"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={contactDisplayName}
                  onChange={(e) => setContactDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Contact"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedMessagePanel;

