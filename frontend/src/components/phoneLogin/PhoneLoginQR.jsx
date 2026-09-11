import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react';
import Spinner from '../common/Spinner';
import ConfirmDialog from '../common/ConfirmDialog';
import { api, getFriendlyErrorMessage } from '../../utils/api';

/**
 * A QR that signs a phone in, and what happened to it.
 *
 * Used twice: the header menu ("Log in to mobile app", for yourself) and the
 * staff panel's Phone login tab (for somebody you manage, via `userId`). The
 * server decides who may show a code for whom; this only shows the answer.
 *
 * The code on screen is replaced a few seconds before it expires, and the
 * server retires the old one when it issues the new, so a panel left open
 * never has more than one working code behind it. While a code is showing, the
 * panel asks every couple of seconds whether it has been used, so it can say
 * which phone signed in and offer to block it if that was not who it should be.
 */

const APP_STORE = 'https://apps.apple.com/app/molarplus';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.molarplus.app&pcampaignid=web_share';
const POLL_MS = 2500;
const REFRESH_EARLY_S = 5;

const PhoneLoginQR = ({ userId = null, personName = null }) => {
  const [code, setCode] = useState(null);         // { id, qr, expires_in }
  const [left, setLeft] = useState(0);
  const [error, setError] = useState('');
  const [used, setUsed] = useState(null);         // { device_name, used_at, blocked }
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const alive = useRef(true);

  const issue = useCallback(async () => {
    setError('');
    setUsed(null);
    try {
      const res = await api.post('/auth/phone-login/code', userId ? { user_id: userId } : {});
      if (!alive.current) return;
      setCode(res);
      setLeft(res.expires_in);
    } catch (e) {
      if (alive.current) setError(getFriendlyErrorMessage(e));
    }
  }, [userId]);

  useEffect(() => {
    alive.current = true;
    issue();
    return () => { alive.current = false; };
  }, [issue]);

  // The countdown, and a fresh code just before this one runs out.
  useEffect(() => {
    if (!code || used) return undefined;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= REFRESH_EARLY_S) { issue(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [code, used, issue]);

  // Has it been used yet?
  useEffect(() => {
    if (!code || used) return undefined;
    const t = setInterval(async () => {
      try {
        const s = await api.get(`/auth/phone-login/code/${code.id}`);
        if (alive.current && s.status === 'used') setUsed(s);
      } catch { /* a missed poll is not worth a message */ }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [code, used]);

  const block = async () => {
    setBlocking(true);
    try {
      await api.post(`/auth/phone-login/code/${code.id}/block`);
      setUsed((u) => ({ ...u, blocked: true }));
      setConfirmBlock(false);
    } catch (e) {
      setError(getFriendlyErrorMessage(e));
    } finally {
      setBlocking(false);
    }
  };

  const who = personName ? `${personName}'s` : 'your';
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');

  if (used) {
    return (
      <div className="text-center py-6">
        {used.blocked ? (
          <>
            <ShieldAlert className="mx-auto text-amber-600" size={40} />
            <p className="mt-3 text-base font-semibold text-gray-900">That phone is blocked</p>
            <p className="mt-1 text-sm text-gray-500">
              {used.device_name || 'The phone'} was signed out. It can be unblocked from Control Center, Devices.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
            <p className="mt-3 text-base font-semibold text-gray-900">
              Signed in on {used.device_name || 'a phone'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {personName ? `${personName} can use MolarPlus on that phone now.` : 'You can use MolarPlus on that phone now.'}
            </p>
            <button
              type="button"
              onClick={() => setConfirmBlock(true)}
              className="mt-4 text-sm font-semibold text-red-600 hover:text-red-700"
            >
              Not {personName ? 'them' : 'you'}? Block that phone
            </button>
          </>
        )}
        <div>
          <button
            type="button"
            onClick={issue}
            className="mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={14} /> Show a new code
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <ConfirmDialog
          open={confirmBlock}
          onClose={() => !blocking && setConfirmBlock(false)}
          tone="danger"
          title="Block this phone?"
          message={`${used.device_name || 'The phone'} will be signed out now and won't be able to sign in again until it's unblocked in Control Center, Devices.`}
          actions={[{ label: blocking ? 'Blocking…' : 'Block phone', onClick: block, variant: 'danger' }]}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
      <div className="shrink-0 w-56 text-center">
        <div className="w-56 h-56 rounded-xl border border-gray-200 bg-white p-2 grid place-items-center">
          {code ? (
            <img src={code.qr} alt={`QR code to sign in to ${who} MolarPlus account`} className="w-full h-full" />
          ) : error ? (
            <Smartphone className="text-gray-300" size={48} />
          ) : (
            <Spinner />
          )}
        </div>
        {code && (
          <p className="mt-2 text-xs text-gray-500 tabular-nums">
            Refreshes in {mm}:{ss}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          Sign in to {who} account on a phone
        </p>
        <ol className="mt-3 space-y-2.5 text-sm text-gray-600 list-decimal pl-5">
          <li>
            Install MolarPlus from the{' '}
            <a href={APP_STORE} target="_blank" rel="noreferrer" className="font-semibold text-[#29828a] hover:underline">App Store</a>
            {' '}or{' '}
            <a href={PLAY_STORE} target="_blank" rel="noreferrer" className="font-semibold text-[#29828a] hover:underline">Google Play</a>.
          </li>
          <li>Open it and tap <span className="font-semibold text-gray-800">Scan QR to log in</span> on the sign-in screen.</li>
          <li>Point the camera at this code. That's it, no password needed.</li>
        </ol>
        <p className="mt-4 text-xs text-gray-400">
          The code works once and changes every two minutes. Only show it to {personName || 'yourself'}.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default PhoneLoginQR;
