import React from 'react';

/**
 * Friendly empty state — an unDraw illustration with a short, warm message.
 * Drop into any list, table cell, card grid or chart that can have no data.
 *
 *   import { receipt } from '../../assets/illustrations';
 *   <EmptyState image={receipt} title="No transactions yet"
 *     subtitle="Invoices and payments show up here as you bill patients." />
 *
 * Props:
 *   image     imported illustration URL (src/assets/illustrations)
 *   title     one short line (bold)
 *   subtitle  a gentle hint (optional)
 *   action    optional node rendered below (e.g. a button)
 *   size      'sm' | 'md' | 'lg' — illustration height (default 'md')
 */
const IMG_H = { sm: 'h-20', md: 'h-32', lg: 'h-44' };

const EmptyState = ({ image, title, subtitle, action, size = 'md', className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}>
    {image && (
      <img
        src={image}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`${IMG_H[size] || IMG_H.md} w-auto mb-5 select-none opacity-95`}
      />
    )}
    {title && <p className="text-base font-semibold text-gray-900">{title}</p>}
    {subtitle && <p className="text-sm text-gray-500 mt-1 max-w-xs">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
