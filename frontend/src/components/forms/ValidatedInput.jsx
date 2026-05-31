import { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Text input (or textarea) with live inline validation feedback:
 *  - a green check appears as soon as the value is valid (real-time, no blur needed)
 *  - a red border + message appears only after the field is blurred (so we don't
 *    nag the user mid-typing)
 *
 * `isValid` is computed by the parent from the current value. `errorText` is the
 * message shown when the field has been touched and is still invalid.
 */
const ValidatedInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  isValid = false,
  errorText,
  hint,
  required = false,
  rows,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  min,
  max,
  className = '',
  labelClassName = 'block text-sm font-medium text-gray-700 mb-2',
  showValid = true,
}) => {
  const [touched, setTouched] = useState(false);
  const hasValue = value != null && String(value).length > 0;
  const showCheck = showValid && isValid && hasValue;
  const showError = touched && hasValue && !isValid;

  const stateBorder = showError
    ? 'border-red-300 focus:ring-red-400 focus:border-transparent'
    : showCheck
    ? 'border-green-400 focus:ring-green-400 focus:border-transparent'
    : 'border-gray-300 focus:ring-[#2a276e] focus:border-transparent';

  const base = `w-full px-4 py-3 pr-11 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${stateBorder} ${className}`;

  const isTextarea = rows != null;
  const iconPos = isTextarea ? 'top-3.5' : 'top-1/2 -translate-y-1/2';

  return (
    <div>
      {label && <label className={labelClassName}>{label}</label>}
      <div className="relative">
        {isTextarea ? (
          <textarea
            name={name}
            value={value}
            onChange={onChange}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            required={required}
            rows={rows}
            className={`${base} resize-none`}
          />
        ) : (
          <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            required={required}
            autoComplete={autoComplete}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            min={min}
            max={max}
            className={base}
          />
        )}

        {showCheck && (
          <CheckCircle2
            size={20}
            className={`pointer-events-none absolute right-3 ${iconPos} text-green-500 animate-in fade-in zoom-in duration-200`}
          />
        )}
        {showError && (
          <AlertCircle
            size={20}
            className={`pointer-events-none absolute right-3 ${iconPos} text-red-400`}
          />
        )}
      </div>

      {showError && errorText ? (
        <p className="mt-1 text-xs text-red-500">{errorText}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
};

export default ValidatedInput;
