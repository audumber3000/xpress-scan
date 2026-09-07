import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check } from 'lucide-react';

/**
 * One question on the patient's form, rendered from the template's field type.
 *
 * Built for a thumb, not a mouse: this is opened from a WhatsApp message on a
 * phone, so every control is a full-width tap target rather than a native
 * select or a small checkbox. A dropdown of eight blood groups is three taps
 * and a scroll on a phone; eight buttons is one.
 *
 * The medical history added the types a long legal form needs. Two of them
 * exist because of what a phone does to a paper layout:
 *
 *   `checkbox_grid`  forty conditions as one question. As forty separate
 *                    yes/no rows this is where people abandon the form.
 *   `yes_no_explain` the follow-up box only appears on Yes, so the form is
 *                    five questions long for the patient it does not apply to
 *                    and ten for the one it does.
 */
const LABEL = 'block text-[15px] font-semibold text-gray-900 leading-snug';
const HELP = 'mt-1 text-[13px] text-gray-500 leading-snug';
const INPUT =
  'mt-2.5 w-full rounded-xl border border-gray-300 px-3.5 py-3 text-[15px] text-gray-900 ' +
  'outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15 transition';

const Choice = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2.5 w-full rounded-xl border px-3.5 py-3 text-left text-[15px] transition ${
      selected
        ? 'border-[#2a276e] bg-[#2a276e]/5 text-[#2a276e] font-semibold'
        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
    }`}
  >
    <span
      className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
        selected ? 'border-[#2a276e] bg-[#2a276e] text-white' : 'border-gray-300 bg-white'
      }`}
      aria-hidden="true"
    >
      {selected && <Check size={13} strokeWidth={3} />}
    </span>
    <span className="min-w-0">{children}</span>
  </button>
);

/** A tick in the condition list. Denser than Choice: forty of these are on
 *  screen at once, so they are a row of text rather than a full-height card. */
const Tick = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2.5 w-full rounded-lg border px-3 py-2.5 text-left text-[14px] transition ${
      on
        ? 'border-[#2a276e] bg-[#2a276e]/5 text-[#2a276e] font-semibold'
        : 'border-gray-200 bg-white text-gray-700'
    }`}
  >
    <span
      className={`w-[18px] h-[18px] rounded border flex items-center justify-center flex-shrink-0 ${
        on ? 'border-[#2a276e] bg-[#2a276e] text-white' : 'border-gray-300 bg-white'
      }`}
      aria-hidden="true"
    >
      {on && <Check size={12} strokeWidth={3} />}
    </span>
    <span className="min-w-0">{children}</span>
  </button>
);

const FormField = ({ field, value, onChange, invalid }) => {
  const sigPad = useRef(null);
  const { key, label, type, required, options = [], help } = field;

  const yesNo = type === 'yes_no_explain' && value && typeof value === 'object' ? value : {};
  const setYesNo = (patch) => onChange({ answer: '', explain: '', ...yesNo, ...patch });

  const header = (
    <>
      <label htmlFor={key} className={LABEL}>
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      {/* The declaration carries its wording in `help`, and that wording is the
          thing being agreed to, so it gets its own block below rather than the
          small grey hint treatment. */}
      {help && type !== 'declaration' && <p className={HELP}>{help}</p>}
    </>
  );

  return (
    <fieldset
      className={`min-w-0 rounded-2xl border p-4 ${
        invalid ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-white'
      }`}
      style={{ minInlineSize: 0 }}
    >
      {header}

      {(type === 'text' || type === 'email' || type === 'phone') && (
        <input
          id={key}
          type={type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'}
          inputMode={type === 'phone' ? 'tel' : undefined}
          autoComplete={type === 'email' ? 'email' : type === 'phone' ? 'tel' : undefined}
          className={INPUT}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === 'textarea' && (
        <textarea id={key} rows={3} className={INPUT}
                  value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}

      {type === 'date' && (
        <input id={key} type="date" className={INPUT}
               value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}

      {type === 'boolean' && (
        <div className="mt-2.5">
          <Choice selected={value === true} onClick={() => onChange(value === true ? null : true)}>
            Yes, I agree
          </Choice>
        </div>
      )}

      {type === 'single_select' && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((o) => (
            <Choice key={o} selected={value === o} onClick={() => onChange(value === o ? null : o)}>
              {o}
            </Choice>
          ))}
        </div>
      )}

      {type === 'multi_select' && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((o) => {
            const list = Array.isArray(value) ? value : [];
            const on = list.includes(o);
            return (
              <Choice
                key={o}
                selected={on}
                onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
              >
                {o}
              </Choice>
            );
          })}
        </div>
      )}

      {type === 'checkbox_grid' && (() => {
        const list = Array.isArray(value) ? value : [];
        return (
          <>
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {options.map((o) => {
                const on = list.includes(o);
                return (
                  <Tick
                    key={o}
                    on={on}
                    onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
                  >
                    {o}
                  </Tick>
                );
              })}
            </div>
            {/* Stated rather than left to inference: an empty list here means
                "none of these", and a patient who is not told that will hunt
                for a None option and then worry they missed something. */}
            <p className="mt-2.5 text-[13px] text-gray-500">
              {list.length
                ? `${list.length} ticked. Tap again to remove one.`
                : 'Nothing ticked, which we will read as none of these.'}
            </p>
          </>
        );
      })()}

      {type === 'yes_no_explain' && (
        <div className="mt-2.5">
          <div className="grid grid-cols-2 gap-2">
            {['Yes', 'No'].map((o) => (
              <Choice
                key={o}
                selected={yesNo.answer === o}
                onClick={() => setYesNo({ answer: yesNo.answer === o ? '' : o })}
              >
                {o}
              </Choice>
            ))}
          </div>
          {yesNo.answer === 'Yes' && (
            <div className="mt-2.5">
              <label htmlFor={`${key}-explain`} className="text-[14px] font-medium text-gray-700">
                Please explain
              </label>
              <textarea
                id={`${key}-explain`}
                rows={2}
                className={INPUT}
                value={yesNo.explain || ''}
                onChange={(e) => setYesNo({ explain: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      {type === 'declaration' && (
        <div className="mt-2.5">
          {/* Capped and scrollable rather than collapsed behind a "read more":
              the patient has to be able to see it is long, and a declaration
              somebody has to expand before they can read it is one they will
              agree to without reading. */}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2.5">
            {(help || '').split('\n').filter((p) => p.trim()).map((para, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-gray-700">{para}</p>
            ))}
          </div>
          <div className="mt-2.5">
            <Choice selected={value === true} onClick={() => onChange(value === true ? null : true)}>
              I have read and accept the above
            </Choice>
          </div>
        </div>
      )}

      {type === 'signature' && (
        <div className="mt-2.5">
          <div className="rounded-xl border border-gray-300 bg-white overflow-hidden">
            <SignatureCanvas
              ref={sigPad}
              penColor="#111827"
              canvasProps={{ className: 'w-full h-40 touch-none' }}
              onEnd={() => onChange(sigPad.current?.toDataURL() || null)}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[13px] text-gray-500">Sign with your finger.</p>
            <button
              type="button"
              onClick={() => { sigPad.current?.clear(); onChange(null); }}
              className="text-[13px] font-semibold text-[#2a276e] hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
};

export default FormField;
