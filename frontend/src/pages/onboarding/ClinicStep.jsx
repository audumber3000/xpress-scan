import React from 'react';
import { Building2, Globe, MessageCircle, AlertTriangle, Info } from 'lucide-react';
import ValidatedInput from '../../components/forms/ValidatedInput';
import ClinicAddressField from '../../components/onboarding/ClinicAddressField';
import { flagEmoji } from '../../utils/detectCountry';
import { isNonEmpty } from '../../utils/validators';
import { phoneHint } from '../../utils/phoneHints';

/**
 * Screen one: the four facts the product cannot run without.
 *
 * Everything here earns its place by being load-bearing on day one. The
 * country sets the currency, the timezone and what tax is called; the name and
 * address print on every invoice and prescription; the number is where the
 * verification code goes and where patients get their reminders.
 *
 * The screen this replaced opened with "Tell us about you" and asked for a
 * full name it already had and a degree the backend threw away — a whole
 * mandatory screen that stored nothing, shown first, to people who had just
 * signed in with one Google click and had nothing invested yet. Four in ten
 * never reached the end of the wizard.
 *
 * Each field says what it is for, right under it. Onboarding is the one moment
 * a person is willing to read, and "we ask because X" is the difference
 * between a form and a conversation.
 */

const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700';
const selectCls =
  'w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent';

const ClinicStep = ({ data, onChange, countries, onAddressPlace, onAddressManual }) => {
  const active = countries.find((c) => c.code === data.country);
  const dialCode = active?.phone_code || '';
  const hint = phoneHint(data.clinic_phone, data.country, dialCode);

  const set = (name) => (e) => onChange(name, e.target.value);

  return (
    <div className="space-y-5">
      <header className="animate-ob-rise" style={{ '--ob-i': 0 }}>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">Let&apos;s set up your clinic</h2>
        <p className="mt-1 text-sm text-gray-500">
          Four details, then you&apos;re in. These print on your invoices and prescriptions.
        </p>
      </header>

      {/* Country first: it decides the currency, the tax wording and the dial
          code every field under it depends on. */}
      <div className="animate-ob-rise" style={{ '--ob-i': 1 }}>
        <label htmlFor="ob-country" className={labelCls}>
          <span className="flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-gray-400" /> Country *
          </span>
        </label>
        <select
          id="ob-country"
          name="country"
          value={data.country}
          onChange={set('country')}
          className={selectCls}
        >
          {countries.length > 0 ? (
            [...countries]
              .sort((a, b) => (a.code === data.country ? -1 : b.code === data.country ? 1 : 0))
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {flagEmoji(c.code)}  {c.name} ({c.currency_symbol})
                </option>
              ))
          ) : (
            <option value="IN">{flagEmoji('IN')}  India (₹)</option>
          )}
        </select>
        {active && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-400">
            <Info size={12} className="mt-0.5 shrink-0" />
            Billing in {active.currency_symbol} {active.currency_code}, tax shown as{' '}
            {active.tax_label}. You can change this later.
          </p>
        )}
      </div>

      <div className="animate-ob-rise" style={{ '--ob-i': 2 }}>
        <ValidatedInput
          label={
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-gray-400" /> Clinic name *
            </span>
          }
          labelClassName={labelCls}
          className="text-sm"
          id="ob-clinic-name"
          name="clinic_name"
          value={data.clinic_name}
          onChange={set('clinic_name')}
          placeholder="Sharma Dental Care"
          isValid={isNonEmpty(data.clinic_name)}
          errorText="Clinic name is required"
          hint="Patients see this on invoices, reminders and your booking page."
        />
      </div>

      <div className="animate-ob-rise" style={{ '--ob-i': 3 }}>
        <ValidatedInput
          label={
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp number *
            </span>
          }
          labelClassName={labelCls}
          className="text-sm"
          id="ob-clinic-phone"
          type="tel"
          name="clinic_phone"
          value={data.clinic_phone}
          onChange={set('clinic_phone')}
          placeholder={dialCode ? `${dialCode} 98765 43210` : '+91 98765 43210'}
          isValid={
            String(data.clinic_phone || '').replace(/\D/g, '').length >= 7 &&
            hint?.level !== 'blocked'
          }
          errorText="Enter a valid phone number"
          hint={
            hint
              ? undefined
              : 'Your verification code comes here, and patient reminders go out from it.'
          }
        />
        {hint && (
          <p
            className={`mt-1.5 flex items-start gap-1.5 text-xs ${
              hint.level === 'blocked' ? 'text-red-600' : 'text-amber-700'
            }`}
          >
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {hint.message}
          </p>
        )}
      </div>

      <div className="animate-ob-rise" style={{ '--ob-i': 4 }}>
        <ClinicAddressField
          value={data.clinic_address}
          country={data.country}
          onChange={(v, meta) => onChange('clinic_address', v, meta)}
          onPlace={onAddressPlace}
          onManual={onAddressManual}
        />
      </div>
    </div>
  );
};

export default ClinicStep;
