import React from 'react';

const LoadingTest = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      {/* Hand-drawn Clinic Building Animation */}
      <div className="mb-6">
        <svg 
          className="w-32 h-32 mx-auto" 
          viewBox="0 0 200 200" 
          fill="none"
        >
          {/* Building Base - Animated drawing */}
          <rect 
            x="40" 
            y="120" 
            width="120" 
            height="60" 
            fill="white" 
            stroke="black" 
            strokeWidth="3"
            className="animate-draw"
            style={{
              strokeDasharray: "0 400",
              animation: "draw 2s ease-in-out forwards"
            }}
          />
          
          {/* Flat Roof - Animated drawing */}
          <rect 
            x="35" 
            y="120" 
            width="130" 
            height="8" 
            fill="white" 
            stroke="black" 
            strokeWidth="3"
            className="animate-draw"
            style={{
              strokeDasharray: "0 300",
              animation: "draw 1.5s ease-in-out 0.5s forwards"
            }}
          />
          
          {/* Orange CLINIC Sign - Animated drawing */}
          <rect 
            x="50" 
            y="80" 
            width="100" 
            height="25" 
            fill="#FF8C00" 
            stroke="black" 
            strokeWidth="2"
            className="animate-draw"
            style={{
              strokeDasharray: "0 250",
              animation: "draw 1s ease-in-out 1s forwards"
            }}
          />
          
          {/* CLINIC Text on Sign */}
          <text 
            x="100" 
            y="97" 
            textAnchor="middle" 
            fill="black" 
            fontSize="14" 
            fontWeight="bold"
            className="animate-draw"
            style={{
              opacity: 0,
              animation: "fadeIn 0.5s ease-in-out 1.5s forwards"
            }}
          >
            CLINIC
          </text>
          
          {/* Sign Posts - Animated drawing */}
          <rect 
            x="85" 
            y="105" 
            width="4" 
            height="15" 
            fill="#666" 
            stroke="black" 
            strokeWidth="1"
            className="animate-draw"
            style={{
              strokeDasharray: "0 40",
              animation: "draw 0.8s ease-in-out 1.2s forwards"
            }}
          />
          <rect 
            x="111" 
            y="105" 
            width="4" 
            height="15" 
            fill="#666" 
            stroke="black" 
            strokeWidth="1"
            className="animate-draw"
            style={{
              strokeDasharray: "0 40",
              animation: "draw 0.8s ease-in-out 1.2s forwards"
            }}
          />
          
          {/* Blue Window - Animated drawing */}
          <rect 
            x="55" 
            y="130" 
            width="25" 
            height="25" 
            fill="#87CEEB" 
            stroke="black" 
            strokeWidth="2"
            className="animate-draw"
            style={{
              strokeDasharray: "0 100",
              animation: "draw 1s ease-in-out 1.8s forwards"
            }}
          />
          
          {/* Window Reflections - Animated drawing */}
          <path 
            d="M58 133 L62 137 M65 130 L69 134" 
            stroke="black" 
            strokeWidth="1"
            className="animate-draw"
            style={{
              strokeDasharray: "0 20",
              animation: "draw 0.5s ease-in-out 2.2s forwards"
            }}
          />
          
          {/* Gray Door - Animated drawing */}
          <rect 
            x="120" 
            y="140" 
            width="25" 
            height="40" 
            fill="#666" 
            stroke="black" 
            strokeWidth="2"
            className="animate-draw"
            style={{
              strokeDasharray: "0 130",
              animation: "draw 1s ease-in-out 2s forwards"
            }}
          />
          
          {/* Door Handle - Animated drawing */}
          <rect 
            x="140" 
            y="155" 
            width="2" 
            height="8" 
            fill="black"
            className="animate-draw"
            style={{
              opacity: 0,
              animation: "fadeIn 0.3s ease-in-out 2.3s forwards"
            }}
          />
          
          {/* Cross-hatching Shading - Animated drawing */}
          <path 
            d="M45 170 L55 170 M50 165 L50 175" 
            stroke="black" 
            strokeWidth="1"
            className="animate-draw"
            style={{
              strokeDasharray: "0 20",
              animation: "draw 0.5s ease-in-out 2.4s forwards"
            }}
          />
          <path 
            d="M140 170 L150 170 M145 165 L145 175" 
            stroke="black" 
            strokeWidth="1"
            className="animate-draw"
            style={{
              strokeDasharray: "0 20",
              animation: "draw 0.5s ease-in-out 2.4s forwards"
            }}
          />
          <path 
            d="M155 125 L165 125 M160 120 L160 130" 
            stroke="black" 
            strokeWidth="1"
            className="animate-draw"
            style={{
              strokeDasharray: "0 20",
              animation: "draw 0.5s ease-in-out 2.4s forwards"
            }}
          />
          
          {/* Ground Line - Animated drawing */}
          <line 
            x1="30" 
            y1="180" 
            x2="170" 
            y2="180" 
            stroke="black" 
            strokeWidth="2"
            className="animate-draw"
            style={{
              strokeDasharray: "0 140",
              animation: "draw 1s ease-in-out 2.6s forwards"
            }}
          />
        </svg>
      </div>
      
      {/* Loading Spinner */}
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2a276e] mx-auto mb-4"></div>
      
      {/* Loading Text */}
      <p className="text-gray-600 text-lg font-medium">Opening your clinic...</p>
      <div className="text-gray-500 text-sm mt-2 flex items-center justify-center">
        <span>Doctor please wait while we </span>
        <div className="w-64 h-6 ml-1 overflow-hidden bg-gray-100 rounded px-2 flex items-center justify-start">
          <div className="relative w-full h-full">
            {(() => {
              const actions = [
                "opening lock",
                "opening windows", 
                "switching lights",
                "switching computer",
                "setting table",
                "brooming floor",
                "cleaning windows",
                "organizing files",
                "checking equipment",
                "preparing room",
                "arranging chairs",
                "testing machines",
                "stocking supplies",
                "checking temperature",
                "preparing forms",
                "final inspection",
                "warming stethoscope",
                "cleaning tools",
                "updating files",
                "loading records"
              ];
              const [currentAction, setCurrentAction] = React.useState(0);
              
              React.useEffect(() => {
                const interval = setInterval(() => {
                  setCurrentAction((prev) => (prev + 1) % actions.length);
                }, 2000);
                return () => clearInterval(interval);
              }, []);
              
              return (
                <div className="text-[#2a276e] font-medium text-left">
                  {actions.map((action, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 flex items-center justify-start transition-all duration-700 ${
                        index === currentAction 
                          ? 'opacity-100 transform translate-y-0' 
                          : index === ((currentAction + 1) % actions.length)
                            ? 'opacity-0 transform translate-y-full'
                            : 'opacity-0 transform -translate-y-full'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{action}</span>
                        {/* Icons for each action - now on the right side */}
                        {action === "opening lock" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        )}
                        {action === "opening windows" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                          </svg>
                        )}
                        {action === "switching lights" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        )}
                        {action === "switching computer" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                        {action === "setting table" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        )}
                        {action === "brooming floor" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                        {action === "cleaning windows" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                        )}
                        {action === "organizing files" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        {action === "checking equipment" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {action === "preparing room" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        )}
                        {action === "arranging chairs" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                        {action === "testing machines" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        )}
                        {action === "stocking supplies" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        )}
                        {action === "checking temperature" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {action === "preparing forms" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        {action === "final inspection" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                        {action === "warming stethoscope" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h-2m2 0h2m-2-4h-2m2 0h2m-2-4h-2m2 0h2" />
                          </svg>
                        )}
                        {action === "cleaning tools" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0 0H4m8 0H4" />
                          </svg>
                        )}
                        {action === "updating files" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 9a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                          </svg>
                        )}
                        {action === "loading records" && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6m-3-3v6" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes draw {
          to {
            stroke-dasharray: 0 0;
          }
        }
        
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
        
        @keyframes slideUp {
          0% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        
        .animate-draw {
          stroke-dasharray: 0 1000;
          stroke-dashoffset: 0;
        }
        
        .animate-slide-up {
          animation: slideUp 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LoadingTest;
