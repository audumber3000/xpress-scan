import React from 'react';

/**
 * Static Anatomy Icon Renderer
 * Fetches the newly moved images mapped into the frontend public directory
 */
export const AnatomyIcon = ({ type, className = "w-full h-full object-contain drop-shadow-md" }) => {
    
    if (!type) {
        return <div className={className} />;
    }

    // Convert spaces to underscores to match the safe filename mappings
    const safeFilename = type.replace(/ /g, '_');
    const assetUrl = `/anatomy_assets/${safeFilename}.png`;

    return (
        <img 
            src={assetUrl} 
            alt={type} 
            className={className} 
            draggable="false"
            onError={(e) => {
                // If missing, show a silent fallback empty state instead of a broken graphic
                e.target.style.display = 'none';
            }}
        />
    );
};

export default AnatomyIcon;
