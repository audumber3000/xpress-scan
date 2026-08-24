import React from 'react';
import { AlertCircle, CreditCard, Wallet, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { CHANNEL_META, getChannelPriceLabel } from './constants';
import { getCurrencySymbol } from '../../../utils/currency';
import { formatDate } from '../../../utils/datetime';

const StatCard = ({ channel, stats, channelStatus }) => {
  const meta = CHANNEL_META[channel] || {};
  const Icon = meta.icon || (() => null);
  const data = stats[channel] || { sent: 0, total_cost: 0 };
  const status = channelStatus[channel] || {};
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${meta.bg} ${meta.color} rounded-lg`}>
            <Icon size={28} />
          </div>
          <div>
            <span className="font-semibold text-gray-800 text-sm">{meta.label}</span>
            <p className="text-[11px] text-gray-400">{getChannelPriceLabel(channel)}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.configured ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {status.configured ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
          {status.configured ? 'Active' : 'Not set'}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Sent this month</p>
      <h4 className="text-3xl font-bold text-gray-900 mb-4">{data.sent.toLocaleString()}</h4>
      <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs text-gray-400">Total spend</span>
        <span className="text-sm font-semibold text-gray-700">{getCurrencySymbol()}{(data.total_cost || 0).toFixed(2)}</span>
      </div>
    </div>
  );
};

/**
 * Top-up presets. ₹50 leads because it is the floor: a clinic that has just run
 * through its welcome credit can carry on for the price of a chai instead of
 * committing ₹100 to find out whether it wants this. ₹500 stays pre-selected,
 * so the cheap option is available without being the suggested one.
 */
const TOPUP_PRESETS = [50, 100, 500, 1000, 5000];

/** Empty, about to be empty, or merely worth keeping an eye on. */
const balanceState = (balance, lowThreshold, minTopup) => {
  if (balance <= 0) return 'empty';
  if (balance < lowThreshold) return 'critical';
  // Below the price of one top-up. Said in amber, not red: nothing has stopped
  // working, and a clinic in a non-rupee currency gets a threshold that scales
  // with its own floor rather than a hard-coded 50.
  if (balance < minTopup) return 'watch';
  return 'ok';
};

const OverviewTab = ({ stats, channelStatus, wallet, topUpAmount, setTopUpAmount, toppingUp, handleWalletTopup }) => {
  // Server-sent, with the same values hard-coded as a fallback for the moment
  // between an old cached response and a fresh one.
  const minTopup = wallet.min_topup ?? 50;
  const lowThreshold = wallet.low_balance_threshold ?? 5;
  const balance = wallet.balance || 0;
  const state = balanceState(balance, lowThreshold, minTopup);

  return (
  <>
    {/* Stats cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {['whatsapp', 'email', 'sms'].map(ch => (
        <StatCard key={ch} channel={ch} stats={stats} channelStatus={channelStatus} />
      ))}
    </div>

    {/* Wallet + Transactions */}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Transaction history */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm lg:col-span-3">
        <h3 className="font-semibold text-gray-900 mb-5">Recent Top-ups</h3>
        {wallet.transactions && wallet.transactions.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {wallet.transactions.map(txn => (
              <div key={txn.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{txn.description || 'Wallet Top-up'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {txn.created_at ? formatDate(txn.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${txn.transaction_type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {txn.transaction_type === 'credit' ? '+' : '-'}{getCurrencySymbol()}{txn.amount.toFixed(2)}
                  </p>
                  <span className={`text-[11px] font-medium ${txn.status === 'completed' ? 'text-green-600' : txn.status === 'pending' ? 'text-amber-500' : 'text-red-500'}`}>
                    {txn.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50 h-44 gap-2">
            <Wallet size={24} className="text-gray-300" />
            <span className="text-gray-400 text-sm">No transactions yet</span>
          </div>
        )}
      </div>

      {/* Wallet balance + top-up */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm lg:col-span-2 flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#29828a]/10 text-[#29828a] rounded-xl">
            <Wallet size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Wallet Balance</p>
            <h2 className="text-3xl font-bold text-gray-900">{getCurrencySymbol()}{balance.toFixed(2)}</h2>
          </div>
        </div>

        {wallet.last_topup_at && (
          <p className="text-xs text-gray-400">
            Last top-up: {new Date(wallet.last_topup_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}

        {state === 'empty' && (
          <div className="flex items-start gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-semibold border border-red-100">
            <AlertCircle size={14} className="shrink-0 mt-px" />
            <span>
              Balance is empty. Reminders, invoices and review requests are not going out.
              Top up from {getCurrencySymbol()}{minTopup} to start them again.
            </span>
          </div>
        )}
        {state === 'critical' && (
          <div className="flex items-start gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-semibold border border-red-100">
            <AlertCircle size={14} className="shrink-0 mt-px" />
            <span>
              Balance is about to run out. Top up from {getCurrencySymbol()}{minTopup} to keep
              messages going.
            </span>
          </div>
        )}
        {state === 'watch' && (
          <div className="flex items-start gap-2 bg-amber-50 text-amber-600 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-100">
            <AlertCircle size={14} className="shrink-0 mt-px" />
            <span>Running low. You can add {getCurrencySymbol()}{minTopup} or more whenever you like.</span>
          </div>
        )}

        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/40">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-3">
            <CreditCard size={13} className="text-gray-400" /> Add Funds
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-3">
            {TOPUP_PRESETS.map(amt => (
              <button
                key={amt}
                onClick={() => setTopUpAmount(amt)}
                className={`py-2 text-[11px] rounded-lg border font-medium transition-all ${
                  topUpAmount === amt
                    ? 'border-[#29828a] bg-[#29828a]/10 text-[#29828a]'
                    : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
                }`}
              >
                {getCurrencySymbol()}{amt}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={minTopup}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a] outline-none mb-3 transition-all"
            placeholder={`Custom amount (min ${getCurrencySymbol()}${minTopup})`}
            value={topUpAmount}
            onChange={e => setTopUpAmount(Number(e.target.value))}
          />
          <button
            onClick={handleWalletTopup}
            disabled={toppingUp}
            className="w-full py-2.5 bg-[#29828a] hover:bg-[#1f6b72] disabled:bg-gray-300 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2"
          >
            {toppingUp ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : `Add ${getCurrencySymbol()}${topUpAmount} via Cashfree`}
          </button>
        </div>
      </div>
    </div>
  </>
  );
};

export default OverviewTab;
