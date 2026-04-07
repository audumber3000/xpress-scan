import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, CheckCircle, XCircle, Share2, User } from 'lucide-react';

const ConsentRecentLinks = ({ clinicId, refreshKey = 0 }) => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const NEXUS_SERVICES_URL = import.meta.env.VITE_NEXUS_API_URL || `http://${window.location.hostname}:8001/api/v1`;

  const fetchLinks = async () => {
    if (!clinicId) return;
    try {
      const res = await axios.get(`${NEXUS_SERVICES_URL}/consent/list/${clinicId}`);
      setLinks(res.data);
    } catch (error) {
      console.error("Failed to fetch recent consent links:", error);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch on clinicId change AND whenever refreshKey increments (link generated)
  useEffect(() => {
    setLoading(true);
    fetchLinks();
    const interval = setInterval(fetchLinks, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [clinicId, refreshKey]);

  const getStatusInfo = (link) => {
    if (link.used) return { label: 'Signed', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle };
    if (link.timeLeft <= 0) return { label: 'Expired', color: 'text-gray-400', bg: 'bg-gray-50', icon: XCircle };
    return { label: 'Pending', color: 'text-amber-500', bg: 'bg-amber-50', icon: Clock };
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return "Expired";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2a276e]/5 text-[#2a276e] flex items-center justify-center shrink-0">
             <Share2 size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Active Links</h3>
            <p className="text-xs text-gray-500">Consent tracking</p>
          </div>
        </div>
        {links.filter(l => !l.used && l.timeLeft > 0).length > 0 && (
          <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">
            {links.filter(l => !l.used && l.timeLeft > 0).length}
          </div>
        )}
      </div>

      {/* List / Empty State */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#2a276e]/20 border-t-[#2a276e] rounded-full animate-spin"></div>
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" strokeWidth={3} />
            </div>
            <p className="text-sm text-gray-500">No active links</p>
          </div>
        ) : (
          links.map(link => {
            const status = getStatusInfo(link);
            const StatusIcon = status.icon;
            return (
              <div key={link.token} className="bg-gray-50 rounded-lg p-4 border border-gray-200 transition-all hover:border-[#2a276e]/30">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className={`p-1.5 rounded-lg ${status.bg} ${status.color}`}>
                       <User size={14} />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm truncate">{link.patientName}</h4>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.color} flex items-center gap-1`}>
                    <StatusIcon size={10} strokeWidth={3} />
                    {status.label}
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mb-3">
                  {link.templateName}
                </p>

                <div className="flex items-center justify-between mt-auto px-1">
                   <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock size={12} />
                      <span className={link.timeLeft < 60 && !link.used ? "text-red-500 font-semibold" : ""}>
                        {link.used ? "Signed" : formatTime(link.timeLeft)}
                      </span>
                   </div>
                   {!link.used && link.timeLeft > 0 && (
                      <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                         <div 
                           className={`h-full rounded-full transition-all ${link.timeLeft < 60 ? 'bg-red-500' : 'bg-[#2a276e]'}`}
                           style={{ width: `${(link.timeLeft / 300) * 100}%` }}
                         ></div>
                      </div>
                   )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info Footer & Action Button */}
      <div className="mt-auto pt-6">
        <p className="text-xs text-gray-500 text-center">
          Links expire after 5 minutes
        </p>
      </div>
    </div>
  );
};

export default ConsentRecentLinks;
