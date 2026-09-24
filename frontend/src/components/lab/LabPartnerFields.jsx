import React from 'react';
import ClinicAddressField from '../onboarding/ClinicAddressField';

/**
 * The fields of a lab partner, shared by the Add drawer and the Edit modal so
 * the two can never ask for different things.
 *
 * The address is found through Google Places, the same field signup uses for
 * the clinic. It falls back to a plain box when Maps is unavailable, so a
 * Google outage never stops anyone adding a lab.
 *
 * value:    { name, phone, email, address }
 * onChange: (next) => void
 * idPrefix: keeps input ids unique when the drawer and modal are both mounted
 */
const INPUT =
    'w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] ' +
    'focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm transition-all';

const LabPartnerFields = ({ value, onChange, idPrefix = 'lab' }) => {
    const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <label htmlFor={`${idPrefix}-name`} className="text-xs font-medium text-gray-700">Laboratory name</label>
                <input
                    id={`${idPrefix}-name`}
                    required
                    type="text"
                    placeholder="e.g. Precision Dental Labs"
                    value={value.name || ''}
                    onChange={set('name')}
                    className={INPUT}
                />
            </div>
            <div className="space-y-2">
                <label htmlFor={`${idPrefix}-phone`} className="text-xs font-medium text-gray-700">Contact number</label>
                <input
                    id={`${idPrefix}-phone`}
                    required
                    type="text"
                    placeholder="+91 98765 43210"
                    value={value.phone || ''}
                    onChange={set('phone')}
                    className={INPUT}
                />
            </div>
            <div className="space-y-2">
                <label htmlFor={`${idPrefix}-email`} className="text-xs font-medium text-gray-700">Email (optional)</label>
                <input
                    id={`${idPrefix}-email`}
                    type="email"
                    placeholder="contact@lab.com"
                    value={value.email || ''}
                    onChange={set('email')}
                    className={INPUT}
                />
            </div>
            <ClinicAddressField
                inputId={`${idPrefix}-address`}
                label="Laboratory address"
                searchPlaceholder="Search Google for the lab"
                hint="Search by the lab's name or street, or type it in."
                value={value.address || ''}
                onChange={(address) => onChange({ ...value, address })}
            />
        </div>
    );
};

export default LabPartnerFields;
