import React, { useState } from 'react';
import RealisticDentalChart from './RealisticDentalChart';
import AnatomyIcon from './AnatomyIcons';
import ToothSelectionBar from './ToothSelectionBar';
import PerioChartPanel from './perio/PerioChartPanel';

/** Small pill segmented control used for the chart's dentition / numbering toggles. */
const SegmentedToggle = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
    {options.map((opt) => (
      <button
        key={opt.id}
        type="button"
        onClick={() => onChange(opt.id)}
        aria-pressed={value === opt.id}
        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-[background-color,color] duration-150 ease-out ${
          value === opt.id ? 'bg-[#2a276e] text-white' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const TABS = [
  { id: 'dental_chart', label: 'Dental Chart' },
  { id: 'soft_tissue', label: 'Soft Tissue' },
  { id: 'tmj', label: 'TMJ' },
  { id: 'perio', label: 'Perio Chart' },
];

const DentalChartSection = ({
  activeChartTab,
  onTabChange,
  sessionTeethData,
  selectedTooth,
  selectedTeeth = [],
  multiMode,
  onMultiModeChange,
  onToothSelect,
  onToothDragEnter,
  onSelectionDragEnd,
  onQuadrantSelect,
  onArchSelect,
  onToothRemove,
  onSelectionClear,
  onOpenSelection,
  perioChart,
  onPerioChange,
}) => {
  // Adult (permanent) vs Child (primary) chart, and FDI vs Universal numbering —
  // both manual, the doctor decides.
  const [dentition, setDentition] = useState('adult');
  const [numberingSystem, setNumberingSystem] = useState('fdi');

  return (
    <section className="px-1 lg:px-0">
      {/* Navigation Tabs */}
      <div className="flex gap-8 mb-6 border-b border-gray-100 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-selected={activeChartTab === tab.id}
            className={`pb-3 text-sm font-bold whitespace-nowrap border-b-2 relative top-[1px] cursor-pointer transition-[color,border-color] duration-150 ease-out ${
              activeChartTab === tab.id
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-400 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative px-1 lg:px-0">
        {activeChartTab === 'dental_chart' && (
          <div className="animate-view-fade-in">
            {/* Chart controls — right-aligned toolbar: dentition | numbering. */}
            <div className="flex justify-end items-center gap-3 mb-3">
              <SegmentedToggle
                value={dentition}
                onChange={setDentition}
                options={[
                  { id: 'adult', label: 'Adult' },
                  { id: 'primary', label: 'Child' },
                ]}
              />
              <div className="w-px h-6 bg-gray-200" />
              <SegmentedToggle
                value={numberingSystem}
                onChange={setNumberingSystem}
                options={[
                  { id: 'fdi', label: 'FDI' },
                  { id: 'universal', label: 'Universal' },
                ]}
              />
            </div>

            <div className="mb-4">
              <ToothSelectionBar
                selectedTeeth={selectedTeeth}
                multiMode={multiMode}
                onMultiModeChange={onMultiModeChange}
                onQuadrant={onQuadrantSelect}
                onArch={onArchSelect}
                onRemove={onToothRemove}
                onClear={onSelectionClear}
                onOpen={onOpenSelection}
              />
            </div>

            <RealisticDentalChart
              teethData={sessionTeethData}
              selectedTooth={selectedTooth}
              selectedTeeth={selectedTeeth}
              multiMode={multiMode}
              onToothSelect={onToothSelect}
              onToothDragEnter={onToothDragEnter}
              onSelectionDragEnd={onSelectionDragEnd}
              onQuadrantSelect={onQuadrantSelect}
              editable={true}
              dentition={dentition}
              numberingSystem={numberingSystem}
            />

          </div>
        )}

        {activeChartTab === 'soft_tissue' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 animate-view-fade-in w-full">
            {[
              { id: 'Buccal Mucosa' },
              { id: 'Floor of the Mouth' },
              { id: 'Frenum' },
              { id: 'Gingiva' },
              { id: 'Labial Mucosa' },
              { id: 'Palate' },
              { id: 'Salivary Glands' },
              { id: 'Tongue' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToothSelect(item.id)}
                className="bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-between overflow-hidden cursor-pointer hover:border-[#2a276e] transition-[border-color] duration-150 ease-out group aspect-square"
              >
                <div className="flex-1 w-full flex items-center justify-center p-0 overflow-hidden bg-gray-50/20 group-hover:bg-white transition-colors duration-300">
                  <div className="w-full h-full flex items-center justify-center">
                    <AnatomyIcon type={item.id} />
                  </div>
                </div>
                <div className="w-full py-4 border-t border-gray-50 text-center bg-white group-hover:bg-[#2a276e] transition-colors duration-150">
                  <h4 className="text-[10px] font-black text-gray-900 group-hover:text-white uppercase tracking-widest">
                    {item.id}
                  </h4>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeChartTab === 'tmj' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-view-fade-in w-full">
            {['Left TMJ', 'Both TMJ', 'Right TMJ'].map(item => (
              <button
                key={item}
                type="button"
                onClick={() => onToothSelect(item)}
                className="bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-between overflow-hidden cursor-pointer hover:border-[#2a276e] transition-[border-color] duration-150 ease-out group aspect-square"
              >
                <div className="flex-1 w-full flex items-center justify-center p-0 overflow-hidden bg-gray-50/20 group-hover:bg-white transition-colors duration-300">
                  <div className="w-full h-full flex items-center justify-center">
                    <AnatomyIcon type={item} />
                  </div>
                </div>
                <div className="w-full py-5 border-t border-gray-50 text-center bg-white group-hover:bg-[#2a276e] transition-colors duration-150">
                  <h4 className="text-sm font-black text-gray-900 group-hover:text-white uppercase tracking-widest">
                    {item}
                  </h4>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* The chart, kept in the DOM while another tab is showing.

            The clinical summary PDF is built from the chart the browser is
            drawing, and this section unmounts it when you switch to Perio or
            Soft Tissue — so pressing Summary from either tab produced a PDF
            with no chart in it and a line apologising for the fact. Rendering
            it off-screen here keeps exactly one chart mounted at all times,
            with the dentition and numbering the doctor actually chose, which a
            copy mounted anywhere else could not know. */}
        {activeChartTab !== 'dental_chart' && (
          <div aria-hidden="true" className="absolute -left-[9999px] top-0 w-[900px] pointer-events-none">
            <RealisticDentalChart
              teethData={sessionTeethData}
              editable={false}
              showLegend={false}
              dentition={dentition}
              numberingSystem={numberingSystem}
            />
          </div>
        )}

        {activeChartTab === 'perio' && (
          <div className="animate-view-fade-in">
            <PerioChartPanel
              chart={perioChart}
              onChange={onPerioChange}
              teethData={sessionTeethData}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default DentalChartSection;
