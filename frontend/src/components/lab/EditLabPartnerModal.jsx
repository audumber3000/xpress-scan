import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Spinner from '../common/Spinner';
import LabPartnerFields from './LabPartnerFields';

/**
 * Edit a lab partner in a centred modal. Creating one is a drawer; editing
 * pops up in place, so the list stays where it was.
 *
 * partner: the vendor row being edited, or null when closed
 * onSave:  async (id, fields) => void; throws to keep the modal open
 */
const EditLabPartnerModal = ({ partner, onClose, onSave }) => {
    const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!partner) return;
        setForm({
            name: partner.name || '',
            phone: partner.phone || '',
            email: partner.email || '',
            address: partner.address || '',
        });
    }, [partner]);

    useEffect(() => {
        if (!partner) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [partner, saving, onClose]);

    if (!partner) return null;

    const submit = async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await onSave(partner.id, form);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-lab-title"
                onSubmit={submit}
                className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-xl border border-gray-200"
            >
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 id="edit-lab-title" className="text-base font-bold text-gray-900">Edit lab partner</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <LabPartnerFields value={form} onChange={setForm} idPrefix="lab-edit" />
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] inline-flex items-center gap-2 disabled:opacity-60"
                    >
                        {saving ? 'Saving' : 'Save changes'}
                        {saving && <Spinner />}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditLabPartnerModal;
