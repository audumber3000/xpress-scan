import React from "react";
import { Phone, Pencil, Printer, Trash2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { openWhatsApp } from "../../utils/whatsapp";
import { notify } from "../../utils/notify";

/**
 * Patient-level actions, as circular icons in the file header.
 *
 * Matches the mobile app's patient screen (PatientDetailsScreen.tsx), where the
 * same four live beside the name. These replaced a "Save Clinical Records"
 * button that only ever re-POSTed unchanged data.
 *
 * They are patient-level, not tab-level, so unlike the button they replaced
 * these show on every tab. The whole header is already hidden while a case
 * paper is open, which is correct: that is clinical mode, not admin mode.
 */
const ActionButton = ({ label, onClick, tone = "brand", children }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
      tone === "danger"
        ? "bg-red-50 text-red-600 hover:bg-red-100"
        : "bg-[#2a276e]/10 text-[#2a276e] hover:bg-[#2a276e]/20"
    }`}
  >
    {children}
  </button>
);

const PatientHeaderActions = ({ patient, onEdit, onPrint, onDelete }) => {
  if (!patient) return null;
  const phone = patient.phone;

  const handleWhatsApp = () => {
    const ok = openWhatsApp(phone, `Hello ${patient.name || ""}`.trim());
    if (!ok) notify.problem("This patient's number can't be opened in WhatsApp.");
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {phone && (
        <>
          <ActionButton label="Call patient" onClick={() => { window.location.href = `tel:${phone}`; }}>
            <Phone size={17} />
          </ActionButton>
          <ActionButton label="Message on WhatsApp" onClick={handleWhatsApp}>
            <FaWhatsapp size={18} />
          </ActionButton>
        </>
      )}
      <ActionButton label="Edit patient" onClick={onEdit}>
        <Pencil size={16} />
      </ActionButton>
      <ActionButton label="Print patient file" onClick={onPrint}>
        <Printer size={16} />
      </ActionButton>
      <ActionButton label="Delete patient" tone="danger" onClick={onDelete}>
        <Trash2 size={16} />
      </ActionButton>
    </div>
  );
};

export default PatientHeaderActions;
