import React from 'react';

/**
 * Pagination — drop-in pagination footer used across data tables.
 *
 * Two modes:
 *  - Client-side: pass `totalItems` (you slice the data yourself based on `page` and `pageSize`).
 *  - Hides itself when there's only one page so callers don't need to gate it.
 *
 * Visual style matches the original Payments page so all tables look consistent.
 */
const Pagination = ({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className = '',
  showRange = true,
  // When true, still render the "Showing X of Y" line on a single page (the page
  // buttons stay hidden). Lets a small table show its count instead of nothing.
  alwaysShow = false,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= 0) return null;
  if (totalPages <= 1 && !alwaysShow) return null;

  const multiPage = totalPages > 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);

  // Show up to 5 page-number buttons, centered on the current page where possible.
  const windowSize = Math.min(5, totalPages);
  let firstWindowPage;
  if (totalPages <= 5) firstWindowPage = 1;
  else if (safePage <= 3) firstWindowPage = 1;
  else if (safePage >= totalPages - 2) firstWindowPage = totalPages - 4;
  else firstWindowPage = safePage - 2;

  const pageNumbers = Array.from({ length: windowSize }, (_, i) => firstWindowPage + i);

  const goTo = (p) => onPageChange(Math.min(Math.max(1, p), totalPages));

  return (
    <div className={`bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200 ${className}`}>
      {/* Mobile: simple Prev/Next (only when there's more than one page) */}
      {multiPage ? (
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => goTo(safePage - 1)}
            disabled={safePage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => goTo(safePage + 1)}
            disabled={safePage === totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      ) : (
        <p className="flex-1 text-sm text-gray-700 sm:hidden">
          {totalItems} {totalItems === 1 ? 'result' : 'results'}
        </p>
      )}

      {/* Desktop: full pager + range label */}
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        {showRange ? (
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{rangeStart}</span> to{' '}
            <span className="font-medium">{rangeEnd}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        ) : <span />}
        {multiPage && (
        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
          <button
            onClick={() => goTo(safePage - 1)}
            disabled={safePage === 1}
            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="sr-only">Previous</span>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>

          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => goTo(pageNum)}
              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                safePage === pageNum
                  ? 'z-10 bg-[#2a276e] border-[#2a276e] text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            onClick={() => goTo(safePage + 1)}
            disabled={safePage === totalPages}
            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="sr-only">Next</span>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </nav>
        )}
      </div>
    </div>
  );
};

export default Pagination;
