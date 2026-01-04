import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
// GearLoader component - inline for desktop app
const GearLoader = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C4CF3]"></div>
);
import { api } from "../utils/api";

const PatientFiles = () => {
  const { user } = useAuth();
  const { setTitle, setRefreshFunction } = useHeader();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFiles(files);
    } else {
      const filtered = files.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.patientId.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFiles(filtered);
    }
  }, [searchQuery, files]);

  const getFileIcon = (starred) => {
    return (
      <div className="relative">
        <div className="w-26 h-26 relative">
          {/* Clean folder icon matching the actual design */}
          <svg className="w-26 h-26" viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Folder tab - darker blue, positioned behind and lowered */}
            <rect x="10" y="12" width="40" height="20" rx="5" fill="#42b0c9"/>
            
            {/* Main folder body - light blue, overlapping the tab */}
            <rect x="10" y="20" width="60" height="40" rx="8" fill="#50d8f6"/>
            
            {/* Subtle shadow */}
            <rect x="10" y="56" width="60" height="3" rx="1.5" fill="#42b0c9" opacity="0.3"/>
          </svg>
          
          {/* Star overlay */}
          {starred && (
            <svg className="w-4 h-4 text-yellow-400 absolute -top-1 -right-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          )}
        </div>
      </div>
    );
  };

  const toggleStar = (fileId) => {
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId ? { ...file, starred: !file.starred } : file
      )
    );
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get("/patients/");
      
      // Transform patients into file format
      const patientFiles = response.map(patient => ({
        id: patient.id,
        name: patient.name,
        type: "folder",
        date: new Date(patient.created_at).toLocaleString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        starred: false,
        patientId: `P${String(patient.id).padStart(3, '0')}`,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone
      }));
      
      setFiles(patientFiles);
      setFilteredFiles(patientFiles);
    } catch (error) {
      console.error("Error fetching patients:", error);
      setFiles([]);
      setFilteredFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTitle('Patient Files');
    setRefreshFunction(() => fetchPatients);
  }, [setTitle, setRefreshFunction]);

  useEffect(() => {
    fetchPatients();
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header - Removed, now in global Header */}

      {/* Search */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search patient files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]"
            />
          </div>
        </div>
      </div>

      {/* Files Grid Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto p-6">
          {loading ? (
            <div className="w-full flex items-center justify-center py-16">
              <div className="text-center">
                <GearLoader size="w-8 h-8" className="mx-auto" />
                <p className="mt-2 text-sm text-gray-600">Loading patient files...</p>
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchQuery ? "No files found" : "No patient files"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery 
                  ? "Try adjusting your search terms or browse all files."
                  : "Patient files will appear here once patients are registered."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                  onClick={() => {
                    // Navigate to patient profile using numeric ID
                    navigate(`/patient-profile/${file.id}`);
                  }}
                >
                  {/* File Icon */}
                  <div className="mb-3 relative">
                    {getFileIcon(file.starred)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(file.id);
                      }}
                      className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4 text-gray-400 hover:text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    </button>
                  </div>

                  {/* File Details */}
                  <div className="text-center w-full">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                      {file.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {file.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientFiles;
