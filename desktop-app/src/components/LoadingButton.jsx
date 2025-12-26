import React from 'react';

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
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
      )}
      {children}
    </button>
  );
};

export default LoadingButton; 