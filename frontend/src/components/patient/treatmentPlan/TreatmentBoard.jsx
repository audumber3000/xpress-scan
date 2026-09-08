import React, { useMemo, useState } from 'react';
import TreatmentCard from './TreatmentCard';
import { STATUS_META, STATUS_ORDER, deriveColumns } from './planUtils';

/**
 * The plan as three columns you drag work across.
 *
 * Good for moving a case along ("this one's done, that one's started"), which
 * is why it stays the default. For reading the whole plan and its cost in one
 * pass, the table beside it is the better tool.
 */
const EMPTY_COPY = {
  planned: 'Nothing planned yet. Pick a tooth on the chart to add a procedure.',
  'in-progress': 'Nothing started yet.',
  completed: 'Nothing completed yet.',
};

const TreatmentBoard = ({
  treatmentPlan = [],
  treatmentHistory = [],
  teethData = {},
  currentUserName,
  onUpdatePlan,
  onEditStart,
  onDelete,
}) => {
  const [dragOver, setDragOver] = useState(null);

  const columns = useMemo(
    () => deriveColumns(treatmentPlan, treatmentHistory),
    [treatmentPlan, treatmentHistory]
  );

  const handleStatusChange = (item, status) => {
    if (item.status === status) return;
    onUpdatePlan(treatmentPlan.map((p) => (p.id === item.id ? { ...p, status } : p)));
  };

  const handleQtyChange = (item, delta) => {
    const next = Math.max(1, (Number(item.qty) || 1) + delta);
    onUpdatePlan(treatmentPlan.map((p) => (p.id === item.id ? { ...p, qty: next } : p)));
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('itemId');
    if (!id) return;
    const item = treatmentPlan.find((p) => String(p.id) === String(id));
    if (item) handleStatusChange(item, status);
  };

  return (
    <div className="flex flex-col lg:flex-row w-full bg-white border border-gray-200 rounded-xl overflow-hidden animate-view-fade-in">
      {STATUS_ORDER.map((status, idx) => {
        const meta = STATUS_META[status];
        const items = columns[status];
        return (
          <div
            key={status}
            onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
            onDragLeave={() => setDragOver((d) => (d === status ? null : d))}
            onDrop={(e) => handleDrop(e, status)}
            className={`flex-1 flex flex-col min-h-[400px] border-gray-200 transition-colors duration-150 ease-out
              ${idx < 2 ? 'border-b lg:border-b-0 lg:border-r' : ''}
              ${dragOver === status ? 'bg-[#2a276e]/[0.04]' : 'bg-gray-50/50'}`}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
              <h4 className={`flex items-center gap-2 text-sm font-semibold ${meta.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </h4>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${meta.chip}`}>
                {items.length}
              </span>
            </div>

            <div className="flex-1 max-h-[560px] overflow-y-auto custom-scrollbar p-4">
              {items.length === 0 ? (
                <p className="pt-10 px-2 text-center text-xs text-gray-400 leading-relaxed">
                  {EMPTY_COPY[status]}
                </p>
              ) : (
                items.map((item, i) => (
                  <TreatmentCard
                    key={item.id ?? `${status}-${i}`}
                    item={item}
                    isHistory={!!item.isHistory}
                    teethData={teethData}
                    currentUserName={currentUserName}
                    onEditStart={onEditStart}
                    onDelete={onDelete}
                    onStatusChange={handleStatusChange}
                    onQtyChange={handleQtyChange}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TreatmentBoard;
