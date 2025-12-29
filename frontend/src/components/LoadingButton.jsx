import React from 'react';
import GearLoader from './GearLoader';

const LoadingButton = ({ 
  children, 
  loading = false, 
  disabled = false, 
  className = "", 
  onClick, 
  type = "button",
  title = "",
  ...props 
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 transition-all duration-200 ${className} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      title={title}
      {...props}
    >
      {loading && (
        <GearLoader size="w-4 h-4" />
      )}
      {children}
    </button>
  );
};

export default LoadingButton; 