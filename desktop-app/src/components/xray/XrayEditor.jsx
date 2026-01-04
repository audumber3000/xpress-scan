import React, { useState, useEffect } from 'react';

const XrayEditor = ({ imageData, onImageChange, onSave }) => {
  const [brightness, setBrightness] = useState(0); // -100 to 100
  const [contrast, setContrast] = useState(0); // -100 to 100
  const [originalImage, setOriginalImage] = useState(null);

  useEffect(() => {
    if (imageData) {
      setOriginalImage(imageData);
    }
  }, [imageData]);

  useEffect(() => {
    if (originalImage && onImageChange) {
      // Apply brightness and contrast filters
      // In real implementation, this would process the DICOM image
      const editedImage = {
        ...originalImage,
        brightness,
        contrast,
        // Processed image data would be here
      };
      onImageChange(editedImage);
    }
  }, [brightness, contrast, originalImage, onImageChange]);

  const handleReset = () => {
    setBrightness(0);
    setContrast(0);
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        brightness,
        contrast
      });
    }
  };

  if (!imageData) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-500">
        No image loaded. Capture an X-ray first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Image Editing</h3>
        
        {/* Brightness Control */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Brightness</label>
            <span className="text-sm text-gray-600">{brightness}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Contrast Control */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Contrast</label>
            <span className="text-sm text-gray-600">{contrast}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={contrast}
            onChange={(e) => setContrast(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-2 text-sm bg-[#6C4CF3] hover:bg-[#5b3dd9] text-white rounded-lg transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
        <div className="bg-white border border-gray-300 rounded p-2">
          <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
            <p className="text-xs text-gray-400">
              Image preview with brightness: {brightness}, contrast: {contrast}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default XrayEditor;


