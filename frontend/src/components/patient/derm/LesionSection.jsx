import React, { useState } from 'react';
import { Plus, ScanLine, MapPin, AlertTriangle, Ruler } from 'lucide-react';
import { BODY_REGIONS, emptyLesion, describeLesion } from './dermVocabulary';
import { SectionHeading, Section } from './DermControls';
import LesionDrawer from './LesionDrawer';

/**
 * The examination: what is on the skin, and where.
 *
 * This is the section that replaces the tooth chart, and it works the same way
 * the chart does — you pick a place on the body, then say what is there. The
 * body is a grouped site list rather than a drawn figure, because a dermatology
 * finding is often "generalised" or "both shins", which a click target on an
 * illustration handles badly, and because a list is legible on the tablet the
 * doctor actually holds.
 *
 * Recorded findings read back as a clinical sentence — "erythematous plaque
 * annular 30 × 20 mm on the extensor" — so a glance at the list is a glance at
 * the examination, without opening anything.
 */

const LesionSection = ({ lesions = [], onChange, embedded = false }) => {
  const [drawer, setDrawer] = useState(null);
  const [picking, setPicking] = useState(false);

  const upsert = (lesion) => {
    const exists = lesions.some((l) => l.id === lesion.id);
    onChange(exists ? lesions.map((l) => (l.id === lesion.id ? lesion : l)) : [...lesions, lesion]);
    setDrawer(null);
  };

  const remove = (id) => {
    onChange(lesions.filter((l) => l.id !== id));
    setDrawer(null);
  };

  const startAt = (site) => {
    setPicking(false);
    setDrawer(emptyLesion(site));
  };

  const sitesWithFindings = new Set(lesions.map((l) => l.site));

  const Wrapper = embedded ? React.Fragment : Section;

  return (
    <Wrapper>
      {!embedded && (
        <SectionHeading
          Icon={ScanLine}
          title="Examination"
          hint="What is on the skin, where, and what it looks like"
        />
      )}

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setPicking((p) => !p)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2a276e] text-white rounded-xl text-xs font-bold hover:bg-[#211e58] transition-colors"
        >
          <Plus size={14} /> Add finding
        </button>
      </div>

      {/* The site picker. Open on demand rather than always on screen: once a
          few findings are recorded, the list of them matters more than the
          list of places one could add another. */}
      {picking && (
        <div className="mb-5 p-4 rounded-xl border border-gray-200 bg-gray-50/60">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Where is it?
          </p>
          <div className="space-y-3">
            {BODY_REGIONS.map((group) => (
              <div key={group.group}>
                <p className="text-[11px] font-semibold text-gray-400 mb-1.5">{group.group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.sites.map((site) => (
                    <button
                      key={site}
                      onClick={() => startAt(site)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        sitesWithFindings.has(site)
                          ? 'bg-[#2a276e]/10 border-[#2a276e]/30 text-[#2a276e]'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {site}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lesions.length === 0 ? (
        <button
          onClick={() => setPicking(true)}
          className="w-full py-10 rounded-xl border-2 border-dashed border-gray-200 text-center hover:border-gray-300 transition-colors"
        >
          <MapPin size={22} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-500">No findings recorded</p>
          <p className="text-xs text-gray-400 mt-1">Pick a site to describe what is there</p>
        </button>
      ) : (
        <div className="space-y-2">
          {lesions.map((lesion) => {
            const flagged = lesion.abcde?.length >= 2;
            return (
              <button
                key={lesion.id}
                onClick={() => setDrawer(lesion)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  flagged
                    ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{lesion.site}</span>
                      {flagged && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <AlertTriangle size={9} />
                          {lesion.abcde.length} ABCDE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 capitalize">{describeLesion(lesion)}</p>

                    {(lesion.secondary?.length > 0 || lesion.distribution) && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {[lesion.distribution, ...(lesion.secondary || [])].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {lesion.notes && (
                      <p className="text-[11px] text-gray-500 mt-1.5 italic line-clamp-2">{lesion.notes}</p>
                    )}
                  </div>

                  {lesion.size_mm && (
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-gray-400 tabular-nums">
                      <Ruler size={11} />
                      {lesion.size_mm}{lesion.size_mm_2 ? `×${lesion.size_mm_2}` : ''} mm
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <LesionDrawer
        lesion={drawer}
        onClose={() => setDrawer(null)}
        onSave={upsert}
        onDelete={drawer && lesions.some((l) => l.id === drawer.id) ? remove : undefined}
      />
    </Wrapper>
  );
};

export default LesionSection;
