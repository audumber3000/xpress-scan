import React, { useState } from 'react';
import { acquireImage } from '../../utils/twain';

const IMAGE_TYPES = [
  { value: 'bitewing', label: 'Bitewing' },
  { value: 'panoramic', label: 'Panoramic' },
  { value: 'periapical', label: 'Periapical' },
  { value: 'occlusal', label: 'Occlusal' },
  { value: 'ceph', label: 'Cephalometric' },
  { value: 'other', label: 'Other' }
];

const XrayCapture = ({ onImageCaptured, disabled = false }) => {
  const [imageType, setImageType] = useState('bitewing');
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleCapture = async () => {
    if (disabled || capturing) return;

    setCapturing(true);
    try {
      const result = await acquireImage({ imageType });
      
      if (result.success && result.imageData) {
        // Convert image data to preview
        // In real implementation, this would handle DICOM data
        setPreview(result.imageData);
        
        if (onImageCaptured) {
          onImageCaptured({
            imageData: result.imageData,
            imageType: imageType,
            width: result.width,
            height: result.height,
            format: result.format
          });
        }
      } else {
        throw new Error('Failed to capture image');
      }
    } catch (error) {
      console.error('Capture error:', error);
      alert(`Failed to capture X-ray: ${error.message}`);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Image Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image Type
        </label>
        <select
          value={imageType}
          onChange={(e) => setImageType(e.target.value)}
          disabled={disabled || capturing}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3] disabled:bg-gray-100"
        >
          {IMAGE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Capture Button */}
      <button
        onClick={handleCapture}
        disabled={disabled || capturing}
        className="w-full px-4 py-3 bg-[#6C4CF3] hover:bg-[#5b3dd9] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {capturing ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Capturing...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Capture X-ray
          </>
        )}
      </button>

      {/* Preview Area */}
      {preview && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
          <div className="bg-white border border-gray-300 rounded p-2">
            <p className="text-xs text-gray-500 text-center py-8">
              DICOM image preview will appear here
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default XrayCapture;


