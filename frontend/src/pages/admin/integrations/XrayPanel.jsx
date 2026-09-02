import React from 'react';
import { Monitor, ScanLine, ImageOff } from 'lucide-react';
import WhatsAppIcon from '../../../components/common/WhatsAppIcon';
import { api } from '../../../utils/api';
import { useAuth } from '../../../contexts/AuthContext';
import { SUPPORT_PHONE_RAW } from '../../../constants/support';

import carestreamLogo from '../../../assets/brand-logos/carestream.png';
import dentsplySironaLogo from '../../../assets/brand-logos/dentsplysirona.png';
import acteonLogo from '../../../assets/brand-logos/acteon.png';
import vatechLogo from '../../../assets/brand-logos/vatech.png';

/**
 * X-ray tab — the sensor and machine brands clinics in India actually run.
 *
 * Capture today goes through the Windows desktop app over TWAIN (see
 * pages/Xray.jsx), so any sensor with a working vendor driver lands straight in
 * the patient file. Cards therefore describe that mechanism rather than claiming
 * per-brand certification — none have been bench-tested. Set `verified: true` on
 * a brand once it has been, and its card says "Tested".
 *
 * LOGOS: each brand renders its own logo image, never initials. Four are
 * bundled in assets/brand-logos/, each taken from the vendor's own site so the
 * mark is the real one rather than an icon service's guess. The remaining two
 * could not be sourced automatically (their sites render client-side), so they
 * show a neutral "logo missing" tile until a file is dropped in. To finish one:
 * save the logo as assets/brand-logos/<key>.png, import it, and set it as
 * `logo` below.
 *
 * Vatech ships a wordmark rather than a square icon, so it carries `wide: true`
 * and gets a landscape tile. Squeezed into the square one it rendered about
 * 13px tall and was unreadable, which is worse than the placeholder it
 * replaced.
 */

const BRANDS = [
  { key: 'vatech',         name: 'Vatech',            origin: 'South Korea', kinds: ['RVG sensor', 'OPG', 'CBCT'], logo: vatechLogo, wide: true },
  { key: 'carestream',     name: 'Carestream Dental', origin: 'USA',         kinds: ['RVG sensor', 'OPG', 'CBCT'], alias: 'Kodak',  logo: carestreamLogo },
  { key: 'dentsplysirona', name: 'Dentsply Sirona',   origin: 'Germany',     kinds: ['RVG sensor', 'OPG', 'CBCT'], alias: 'Schick', logo: dentsplySironaLogo },
  { key: 'planmeca',       name: 'Planmeca',          origin: 'Finland',     kinds: ['RVG sensor', 'OPG', 'CBCT'], logo: null },
  { key: 'genoray',        name: 'Genoray',           origin: 'South Korea', kinds: ['Portable X-ray', 'OPG', 'CBCT'], logo: null },
  { key: 'acteon',         name: 'Acteon',            origin: 'France',      kinds: ['RVG sensor', 'X-ray unit'], alias: 'Sopix', logo: acteonLogo },
];

const BrandCard = ({ brand, onRequest }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
    <div className="p-5 flex items-start gap-3">
      {brand.logo ? (
        <img
          src={brand.logo}
          alt={`${brand.name} logo`}
          className={`h-12 rounded-xl object-contain bg-white border border-gray-100 p-1.5 shrink-0 ${
            brand.wide ? 'w-[72px]' : 'w-12'
          }`}
        />
      ) : (
        // Deliberately neutral, not initials — a placeholder reads as "logo not
        // added yet" instead of inventing a brand identity.
        <div
          className="w-12 h-12 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center shrink-0"
          title="Logo not added yet"
        >
          <ImageOff size={16} className="text-gray-300" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold text-gray-900 text-[15px] truncate">{brand.name}</h4>
          {brand.verified && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
              Tested
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {brand.origin}{brand.alias ? ` · also sold as ${brand.alias}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {brand.kinds.map((k) => (
            <span key={k} className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-auto px-5 py-3 border-t border-gray-50 flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-400">
        {brand.verified ? 'Captures into the patient file' : 'Via desktop app (TWAIN)'}
      </span>
      {/* Available to any staff member: it opens a chat rather than writing to
          the owner-only feature board, so there's no 403 to guard against. */}
      <button
        onClick={() => onRequest(brand)}
        className="text-[11px] font-semibold text-[#25D366] hover:text-[#1da851] inline-flex items-center gap-1.5 shrink-0"
      >
        <WhatsAppIcon size={13} /> Request setup
      </button>
    </div>
  </div>
);

const XrayPanel = () => {
  const { user } = useAuth();

  // Requests land on the shared feature-request board, so demand for a brand
  // aggregates across clinics instead of disappearing into a support inbox.
  const requestBrand = (brand) => {
    const clinic = user?.clinic?.name ? ` for ${user.clinic.name}` : '';
    const text = encodeURIComponent(
      `Hi MolarPlus support team, I'd like to set up the ${brand.name} `
      + `(${brand.kinds.join(', ')}) X-ray integration${clinic}. Can you help me get started?`
    );
    window.open(`https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`, '_blank', 'noopener,noreferrer');

    // Still counted on the feature board so we can see which sensors clinics
    // actually run. Owner-only server-side, best-effort, and never in the way of
    // the chat that just opened.
    if (user?.role === 'clinic_owner') {
      api.post('/feature-requests', {
        title: `X-ray integration: ${brand.name}`,
        description: `A clinic asked for direct X-ray integration with ${brand.name} (${brand.kinds.join(', ')}).`,
      }).catch(() => {});
    }
  };

  return (
    <div>
      {/* How it works today — the desktop app is the actual capture path. */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-3xl">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#2a276e]/10 text-[#2a276e] flex items-center justify-center shrink-0">
            <Monitor size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Capture runs through the Windows desktop app</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              RVG sensors talk to us over TWAIN, which is Windows-only. Install the MolarPlus desktop
              app on the machine your sensor is plugged into, make sure the manufacturer's own driver
              is installed, and scans save into the patient file. Panoramic and CBCT machines that
              export DICOM can be uploaded to the patient's X-ray tab from any device.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
        <ScanLine size={16} className="text-[#29828a]" />
        Brands used
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 max-w-5xl">
        {BRANDS.map((brand) => (
          <BrandCard
            key={brand.key}
            brand={brand}
            onRequest={requestBrand}
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white/60 p-5 max-w-3xl">
        <h3 className="text-sm font-semibold text-gray-900">Using a brand that isn't listed?</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Most RVG sensors work through the desktop app as long as the manufacturer's Windows driver
          is installed. If yours doesn't, send us the make and model from Support and we'll take a look.
        </p>
      </div>
    </div>
  );
};

export default XrayPanel;
