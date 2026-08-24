import React, { useState } from 'react';
import { Stethoscope, Plus, X } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import { getCurrencySymbol } from '../../../utils/currency';

/**
 * The first few treatments and what they cost.
 *
 * Until at least one of these exists there is nothing to pick when raising an
 * invoice, which makes it the single setting that most directly stops the
 * product working.
 *
 * Names are pre-filled with the procedures nearly every practice does; prices
 * are deliberately blank. Suggesting a price would be inventing a number for
 * somebody else's business, and a wrong default that gets accepted once will
 * quietly bill patients wrongly for months. Rows left without a price are not
 * submitted.
 *
 * Uses POST /treatment-types/bulk, the same endpoint the CSV import uses.
 */

const SUGGESTED = [
  'Consultation',
  'Scaling and polishing',
  'Composite filling',
  'Root canal treatment',
  'Tooth extraction',
];

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#2a276e]';

const TreatmentsStep = ({ onDone, renderFooter }) => {
  const [rows, setRows] = useState(SUGGESTED.map((name) => ({ name, price: '' })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (i, patch) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const remove = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const add = () => setRows((r) => [...r, { name: '', price: '' }]);

  const priced = rows.filter((r) => r.name.trim() && r.price !== '' && Number(r.price) >= 0);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/treatment-types/bulk', {
        items: priced.map((r) => ({ name: r.name.trim(), price: Number(r.price) })),
      });
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not save your treatments.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <Stethoscope className="h-5 w-5 text-amber-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900">What you charge</h3>
          <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">
            Put a price against the ones you do. Invoices then fill themselves in instead of being
            typed out each time. You can change any of this later, and add the rest as you go.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              aria-label={`Treatment ${i + 1} name`}
              className={`${field} flex-1 min-w-0`}
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Treatment name"
            />
            <div className="relative w-28 shrink-0">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                {getCurrencySymbol()}
              </span>
              <input
                aria-label={`Treatment ${i + 1} price`}
                className={`${field} pl-7`}
                value={row.price}
                inputMode="decimal"
                onChange={(e) => update(i, { price: e.target.value.replace(/[^\d.]/g, '') })}
                placeholder="0"
              />
            </div>
            <button
              onClick={() => remove(i)}
              aria-label={`Remove ${row.name || `row ${i + 1}`}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-500"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2a276e] hover:underline min-h-[2.25rem]"
      >
        <Plus size={13} /> Add another
      </button>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <p className="mt-3 text-[11px] text-gray-400">
        {priced.length === 0
          ? 'Add a price to at least one treatment to save.'
          : `${priced.length} treatment${priced.length === 1 ? '' : 's'} ready to save. Rows without a price are ignored.`}
      </p>

      {renderFooter({ onSave: save, saving, disabled: priced.length === 0 })}
    </div>
  );
};

export default TreatmentsStep;
