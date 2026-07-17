import React, { useState } from 'react';
import RealisticDentalChart from './RealisticDentalChart';
import AnatomyIcon from './AnatomyIcons';

/** Small pill segmented control used for the chart's dentition / numbering toggles. */
const SegmentedToggle = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
    {options.map((opt) => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
          value === opt.id ? 'bg-[#2a276e] text-white' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const DentalChartSection = ({
  activeChartTab,
  onTabChange,
  sessionTeethData,
  selectedTooth,
  onToothSelect,
}) => {
  // Adult (permanent) vs Child (primary) chart, and FDI vs Universal numbering —
  // both manual, the doctor decides.
  const [dentition, setDentition] = useState('adult');
  const [numberingSystem, setNumberingSystem] = useState('fdi');

  return (
    <section className="px-1 lg:px-0">
      {/* Navigation Tabs */}
      <div className="flex gap-8 mb-6 border-b border-gray-100">
        {['dental_chart', 'soft_tissue', 'tmj'].map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`pb-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 relative top-[1px] ${
              activeChartTab === tab 
                ? 'border-[#2a276e] text-[#2a276e]' 
                : 'border-transparent text-gray-400 hover:text-gray-900'
            }`}
          >
            {tab === 'dental_chart' ? 'Dental Chart' : (tab === 'soft_tissue' ? 'Soft Tissue' : 'TMJ')}
          </button>
        ))}
      </div>

      <div className="animate-fade-in relative px-1 lg:px-0">
        {activeChartTab === 'dental_chart' && (
          <>
            {/* Chart controls — right-aligned toolbar: dentition | numbering. */}
            <div className="flex justify-end items-center gap-3 mb-4">
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

            <RealisticDentalChart
              teethData={sessionTeethData}
              selectedTooth={selectedTooth}
              onToothSelect={onToothSelect}
              editable={true}
              dentition={dentition}
              numberingSystem={numberingSystem}
            />
          </>
        )}

        {activeChartTab === 'soft_tissue' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 animate-fade-in w-full">
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
              <div 
                key={item.id}
                onClick={() => onToothSelect(item.id)}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-between overflow-hidden cursor-pointer hover:border-[#2a276e] hover:shadow-xl transition-all group aspect-square"
              >
                <div className="flex-1 w-full flex items-center justify-center p-0 overflow-hidden bg-gray-50/20 group-hover:bg-white transition-colors duration-500">
                  <div className="w-full h-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <AnatomyIcon type={item.id} />
                  </div>
                </div>
                <div className="w-full py-4 border-t border-gray-50 text-center bg-white group-hover:bg-[#2a276e] transition-all">
                  <h4 className="text-[10px] font-black text-gray-900 group-hover:text-white uppercase tracking-widest">
                    {item.id}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeChartTab === 'tmj' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in w-full">
            {['Left TMJ', 'Both TMJ', 'Right TMJ'].map(item => (
              <div 
                key={item}
                onClick={() => onToothSelect(item)}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-between overflow-hidden cursor-pointer hover:border-[#2a276e] hover:shadow-xl transition-all group aspect-square"
              >
                <div className="flex-1 w-full flex items-center justify-center p-0 overflow-hidden bg-gray-50/20 group-hover:bg-white transition-colors duration-500">
                  <div className="w-full h-full flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                    <AnatomyIcon type={item} />
                  </div>
                </div>
                <div className="w-full py-5 border-t border-gray-50 text-center bg-white group-hover:bg-[#2a276e] transition-all">
                  <h4 className="text-sm font-black text-gray-900 group-hover:text-white uppercase tracking-widest">
                    {item}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default DentalChartSection;
