import React, { useEffect, useState, useCallback } from 'react';
import { ChevronUp, Plus, Lightbulb, X, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import ValidatedInput from '../forms/ValidatedInput';
import { isNonEmpty } from '../../utils/validators';
import { SkeletonCards } from '../Skeleton';

const STATUS_STYLES = {
  open:        { label: 'Open',         className: 'bg-gray-100 text-gray-600 border-gray-200' },
  planned:     { label: 'Planned',      className: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'In Progress',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  shipped:     { label: 'Shipped',      className: 'bg-green-50 text-green-700 border-green-200' },
  declined:    { label: 'Declined',     className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const relativeTime = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return d === 1 ? 'yesterday' : `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h >= 1) return `${h}h ago`;
  const m = Math.floor(diff / 60000);
  return m >= 1 ? `${m}m ago` : 'just now';
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.open;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.className}`}>
      {s.label}
    </span>
  );
};

const SubmitModal = ({ existing, onClose, onSaved }) => {
  const isEdit = Boolean(existing);
  const [title, setTitle] = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isNonEmpty(title) || submitting) return;
    setSubmitting(true);
    try {
      const payload = { title: title.trim(), description: description.trim() };
      const saved = isEdit
        ? await api.put(`/feature-requests/${existing.id}`, payload)
        : await api.post('/feature-requests', payload);
      toast.success(isEdit ? 'Feature request updated.' : 'Feature request submitted. Thank you!');
      onSaved(saved, isEdit);
      onClose();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, 'Could not save your request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2a276e]/10 flex items-center justify-center">
              <Lightbulb size={18} className="text-[#2a276e]" />
            </div>
            <h3 className="text-base font-bold text-gray-900">{isEdit ? 'Edit feature request' : 'Request a feature'}</h3>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <ValidatedInput
            label="What would you like us to build?"
            placeholder="e.g. Recurring appointments"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            isValid={isNonEmpty(title)}
            required
          />
          <ValidatedInput
            label="Tell us more (optional)"
            placeholder="Describe the problem it solves and how you'd use it..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            showValid={false}
          />
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isNonEmpty(title)}
              className="px-5 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RequestCard = ({ req, onVote, onEdit, onDelete }) => (
  <div className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <button
      onClick={() => onVote(req)}
      title={req.has_voted ? 'Remove your vote' : 'Upvote'}
      className={`flex flex-col items-center justify-center w-14 flex-shrink-0 rounded-xl border px-2 py-2 transition-colors ${
        req.has_voted
          ? 'border-[#2a276e] bg-[#2a276e]/5 text-[#2a276e]'
          : 'border-gray-200 text-gray-600 hover:border-[#2a276e] hover:text-[#2a276e]'
      }`}
    >
      <ChevronUp size={20} strokeWidth={2.5} />
      <span className="text-sm font-bold leading-none mt-0.5">{req.vote_count}</span>
    </button>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">{req.title}</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={req.status} />
          {req.can_edit && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(req)}
                title="Edit"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDelete(req)}
                title="Delete"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
      {req.description && (
        <p className="mt-1 text-sm text-gray-600 line-clamp-3">{req.description}</p>
      )}
      <p className="mt-2 text-xs text-gray-400">
        {[req.requester_name, req.clinic_name].filter(Boolean).join(' • ')}
        {req.created_at ? ` • ${relativeTime(req.created_at)}` : ''}
      </p>
    </div>
  </div>
);

const FeatureRequestsBoard = () => {
  const { user } = useAuth();
  const isOwner = user?.role === 'clinic_owner';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('top');
  const [showModal, setShowModal] = useState(false);
  const [editingReq, setEditingReq] = useState(null);

  const load = useCallback(async (sortMode) => {
    setLoading(true);
    try {
      const res = await api.get(`/feature-requests?sort=${sortMode}`);
      setRequests(res.requests || []);
    } catch (err) {
      console.error('Failed to load feature requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(sort); }, [sort, load]);

  // Optimistic toggle; reconcile with server response (or revert on failure).
  const handleVote = async (req) => {
    const optimistic = {
      has_voted: !req.has_voted,
      vote_count: req.vote_count + (req.has_voted ? -1 : 1),
    };
    setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, ...optimistic } : r)));
    try {
      const res = await api.post(`/feature-requests/${req.id}/vote`);
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, vote_count: res.vote_count, has_voted: res.has_voted } : r))
      );
    } catch (err) {
      setRequests((prev) => prev.map((r) => (r.id === req.id ? req : r)));
      toast.error('Could not register your vote. Please try again.');
    }
  };

  const handleDelete = async (req) => {
    if (!window.confirm(`Delete "${req.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`/feature-requests/${req.id}`);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success('Feature request deleted.');
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, 'Could not delete this request. Please try again.'));
    }
  };

  // Merge a created/updated request back into the list.
  const handleSaved = (saved, isEdit) => {
    setRequests((prev) =>
      isEdit ? prev.map((r) => (r.id === saved.id ? { ...r, ...saved } : r)) : [saved, ...prev]
    );
  };

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Feature Requests</h2>
          <p className="mt-1 text-sm text-gray-500">
            Vote on what we should build next. The most-requested ideas rise to the top.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            {['top', 'new'].map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  sort === s ? 'bg-[#2a276e] text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s === 'top' ? 'Top' : 'Newest'}
              </button>
            ))}
          </div>
          {isOwner && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-all shadow-sm whitespace-nowrap"
            >
              <Plus size={18} /> Request a feature
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={4} className="grid grid-cols-1 gap-3" />
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Lightbulb size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">No feature requests yet</p>
          <p className="mt-1 text-sm text-gray-400">
            {isOwner ? 'Be the first to request a feature.' : 'Check back soon — or ask your clinic owner to submit one.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {requests.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onVote={handleVote}
              onEdit={setEditingReq}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {(showModal || editingReq) && (
        <SubmitModal
          existing={editingReq}
          onClose={() => { setShowModal(false); setEditingReq(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default FeatureRequestsBoard;
