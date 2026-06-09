import React from 'react';

/**
 * Reusable skeleton-loading primitives. Instead of a centered spinner, these
 * render the page's layout as soft pulsing placeholders so structure appears
 * instantly (same pattern as the dental-labs dashboard).
 */

// Base pulsing block — compose with width/height/rounding utilities.
export const SkeletonBox = ({ className = '' }) => (
    <div className={`bg-gray-100 animate-pulse rounded ${className}`} />
);

// Row of metric/stat cards.
export const SkeletonStatCards = ({ count = 4, className = '' }) => (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                    <SkeletonBox className="w-10 h-10 rounded-lg" />
                    <SkeletonBox className="h-3 w-20" />
                </div>
                <SkeletonBox className="h-7 w-24" />
            </div>
        ))}
    </div>
);

// Skeleton table body. `widths` controls per-column placeholder widths and
// implicitly the column count; pass the same count as the real header.
export const SkeletonTableRows = ({ rows = 8, widths = ['w-16', 'w-40', 'w-24', 'w-20', 'w-24', 'w-20', 'w-12'] }) => (
    <tbody className="bg-white divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
                {widths.map((w, c) => (
                    <td key={c} className="px-6 py-4">
                        <SkeletonBox className={`h-4 ${w}`} />
                    </td>
                ))}
            </tr>
        ))}
    </tbody>
);

// Grid of card placeholders (e.g. file/thumbnail grids).
export const SkeletonCards = ({ count = 8, className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' }) => (
    <div className={className}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="aspect-video bg-gray-100 animate-pulse" />
                <div className="p-3.5 space-y-3">
                    <SkeletonBox className="h-4 w-3/4" />
                    <div className="flex items-center gap-2">
                        <SkeletonBox className="w-6 h-6 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                            <SkeletonBox className="h-3 w-24" />
                            <SkeletonBox className="h-2.5 w-20" />
                        </div>
                    </div>
                </div>
            </div>
        ))}
    </div>
);
