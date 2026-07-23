import React from "react";

/**
 * What an invoice was actually for.
 *
 * A bill's line items are the one thing the list couldn't tell you before, and
 * they're what someone scanning the table is really looking for. Kept to a fixed
 * width so a ten-item invoice can't stretch the table: the row shows the first
 * item plus a count, and the full list is on hover.
 */
const WorkDoneCell = ({ items = [] }) => {
  const list = Array.isArray(items) ? items.filter((i) => i && i.description) : [];

  if (list.length === 0) {
    return <span className="text-sm text-gray-400">No items yet</span>;
  }

  const label = (i) => {
    const qty = Number(i.quantity ?? 1);
    return qty > 1 ? `${i.description} × ${qty}` : i.description;
  };

  // Every item, one per line — the native tooltip handles long lists better
  // than a comma run-on does.
  const full = list.map((i) => `• ${label(i)}`).join("\n");
  const extra = list.length - 1;

  return (
    <div className="max-w-[220px]" title={full}>
      <div className="text-sm text-gray-900 truncate">{label(list[0])}</div>
      {extra > 0 && (
        <div className="text-xs text-gray-400">
          +{extra} more item{extra === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
};

export default WorkDoneCell;
