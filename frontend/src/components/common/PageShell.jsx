import React from 'react';

/**
 * The standard Control Center page container, or nothing at all.
 *
 * Several screens are both a page in their own right and a tab inside a bigger
 * one (Medications, Access & Activity). As a tab, the host has already drawn the
 * heading and owns the scrolling, so a second full-height scroller nested inside
 * the first gives you two scrollbars and a page that will not reach its own
 * bottom.
 *
 * Defined at module scope on purpose. Declaring this inside a component's render
 * body creates a brand new component type on every render, which makes React
 * unmount and remount the entire subtree — the visible symptom being a search
 * box that loses focus after every single keystroke.
 */
const PageShell = ({ embedded = false, children }) =>
  embedded ? (
    <>{children}</>
  ) : (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      {children}
    </div>
  );

export default PageShell;
