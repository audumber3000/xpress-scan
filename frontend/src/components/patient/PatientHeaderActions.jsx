import React from "react";
import { Phone, Pencil, Printer, Trash2 } from "lucide-react";
import MoreMenu from "../common/MoreMenu";
import PatientWhatsAppMenu from "./whatsapp/PatientWhatsAppMenu";

/**
 * Patient-level actions in the file header.
 *
 * Labelled buttons, not bare icon circles. A phone glyph in a circle is a
 * guess until you hover it, and these four are the actions a receptionist uses
 * most on this screen — they can afford the words.
 *
 * Flat: border and fill only, no shadow anywhere. The lifted `shadow-sm`
 * treatment made More float a layer above the three buttons beside it, which
 * read as a different kind of control rather than the same row.
 *
 * Print and Delete live behind More. That keeps a destructive action off the
 * top row of a clinical record, one click away from Edit.
 *
 * WhatsApp is a single button carrying its mark, its word and a set of dots.
 * Pressing it anywhere opens one menu: the chat, and the four things you send
 * rather than type (a bill, a visit summary, a prescription, the review ask).
 * One press, one place. See ./whatsapp/PatientWhatsAppMenu.
 */
const Button = ({ onClick, label, children, tone = "ghost" }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e] ${
      tone === "primary"
        ? "bg-[#2a276e] text-white hover:bg-[#1a1548]"
        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
    }`}
  >
    {children}
  </button>
);

const PatientHeaderActions = ({ patient, user, onEdit, onPrint, onDelete }) => {
  if (!patient) return null;
  const phone = patient.phone;

  return (
    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
      {phone && (
        <>
          <Button onClick={() => { window.location.href = `tel:${phone}`; }} label="Call patient">
            <Phone size={16} className="text-[#2a276e]" />
            <span className="hidden sm:inline">Call</span>
          </Button>
          <PatientWhatsAppMenu patient={patient} user={user} />
        </>
      )}

      <Button onClick={onEdit} label="Edit patient" tone="primary">
        <Pencil size={15} />
        <span className="hidden sm:inline">Edit Patient</span>
      </Button>

      <MoreMenu
        items={[
          {
            key: 'print',
            label: 'Print patient file',
            icon: <Printer size={15} />,
            hint: 'Everything on record, as one document',
            onClick: onPrint,
          },
          {
            key: 'delete',
            label: 'Delete patient',
            icon: <Trash2 size={15} />,
            hint: 'Removes the record and its history',
            danger: true,
            onClick: onDelete,
          },
        ]}
      />
    </div>
  );
};

export default PatientHeaderActions;
