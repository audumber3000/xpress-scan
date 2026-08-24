import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';

/**
 * Clinic name, phone, address and opening hours.
 *
 * The same PUT /clinics/me the full settings screen uses, with the four fields
 * that actually stop things working if they are empty: the first three print on
 * every invoice and prescription, and the hours drive the booking page and the
 * appointment grid.
 *
 * Everything else (logo, registration number, tax details, branding) is left to
 * Control Center. A modal on day one should ask for what is load-bearing, not
 * for everything that exists.
 */

const DAYS = [
  ['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'], ['thursday', 'Thu'],
  ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun'],
];

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#2a276e]';
const label = 'mb-1 block text-xs font-semibold text-gray-600';

const ClinicDetailsStep = ({ onDone, renderFooter }) => {
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [open, setOpen] = useState('09:00');
  const [close, setClose] = useState('20:00');
  const [closedDays, setClosedDays] = useState(['sunday']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/clinics/me').then((c) => {
      setForm({ name: c.name || '', phone: c.phone || '', address: c.address || '' });
      // Read back whatever is already set so this does not silently overwrite
      // hours a clinic configured during onboarding.
      const t = c.timings || {};
      const firstOpen = DAYS.map(([d]) => t[d]).find((v) => v && !v.closed);
      if (firstOpen) {
        setOpen(firstOpen.open || '09:00');
        setClose(firstOpen.close || '20:00');
      }
      const shut = DAYS.filter(([d]) => t[d]?.closed).map(([d]) => d);
      if (shut.length) setClosedDays(shut);
    }).catch(() => {});
  }, []);

  const toggleDay = (day) =>
    setClosedDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const timings = Object.fromEntries(
        DAYS.map(([day]) => [day, { open, close, closed: closedDays.includes(day) }])
      );
      await api.put('/clinics/me', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        timings,
      });
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not save your clinic details.'));
    } finally {
      setSaving(false);
    }
  };

  const ready = form.name.trim() && form.phone.trim() && form.address.trim();

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2a276e]/10">
          <Building2 className="h-5 w-5 text-[#2a276e]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900">Your clinic details</h3>
          <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">
            These print at the top of every invoice and prescription, and the hours decide which
            appointment slots patients can book.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="cd-name" className={label}>Clinic name</label>
          <input
            id="cd-name" className={field} value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Sharma Dental Clinic"
          />
        </div>
        <div>
          <label htmlFor="cd-phone" className={label}>Phone</label>
          <input
            id="cd-phone" className={field} value={form.phone} inputMode="tel"
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="9876543210"
          />
        </div>
        <div>
          <label htmlFor="cd-address" className={label}>Address</label>
          <textarea
            id="cd-address" rows={2} className={`${field} resize-none`} value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Shop 4, MG Road, Pune 411001"
          />
        </div>

        <div>
          <span className={label}>Opening hours</span>
          <div className="flex items-center gap-2">
            <input
              type="time" aria-label="Opens at" value={open}
              onChange={(e) => setOpen(e.target.value)}
              className={`${field} flex-1`}
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="time" aria-label="Closes at" value={close}
              onChange={(e) => setClose(e.target.value)}
              className={`${field} flex-1`}
            />
          </div>
          {/* One set of hours for every open day. A clinic with different hours
              on a Saturday sets that in Control Center; asking for 14 times in a
              day-one modal would be the reason nobody finishes it. */}
          <p className="mt-2 mb-1.5 text-[11px] text-gray-400">Tap any day the clinic is closed.</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map(([day, short]) => {
              const shut = closedDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={!shut}
                  className={`min-h-[2.25rem] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    shut
                      ? 'border-gray-200 bg-gray-100 text-gray-400 line-through'
                      : 'border-[#2a276e] bg-[#2a276e]/5 text-[#2a276e]'
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      {renderFooter({ onSave: save, saving, disabled: !ready })}
    </div>
  );
};

export default ClinicDetailsStep;
