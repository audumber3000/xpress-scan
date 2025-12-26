import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";

const PatientFiles = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sample data - replace with actual API calls
  const sampleFiles = [
    {
      id: 1,
      name: "John Doe",
      type: "folder",
      date: "13 Aug 2025 at 11:26 AM",
      starred: true,
      patientId: "P001"
    },
    {
      id: 2,
      name: "Sarah Wilson",
      type: "folder",
      date: "6 Aug 2025 at 4:59 PM",
      starred: false,
      patientId: "P002"
    },
    {
      id: 3,
      name: "Mike Johnson",
      type: "folder",
      date: "1 Oct 2024 at 1:44 PM",
      starred: true,
      patientId: "P003"
    },
    {
      id: 4,
      name: "Emily Davis",
      type: "folder",
      date: "15 Sep 2024 at 9:30 AM",
      starred: false,
      patientId: "P004"
    },
    {
      id: 5,
      name: "David Brown",
      type: "folder",
      date: "22 Aug 2024 at 2:15 PM",
      starred: true,
      patientId: "P005"
    },
    {
      id: 6,
      name: "Lisa Garcia",
      type: "folder",
      date: "10 Jul 2024 at 5:45 PM",
      starred: false,
      patientId: "P006"
    },
    {
      id: 7,
      name: "Robert Lee",
      type: "folder",
      date: "5 Jul 2024 at 8:20 AM",
      starred: true,
      patientId: "P007"
    },
    {
      id: 8,
      name: "Maria Rodriguez",
      type: "folder",
      date: "28 Jun 2024 at 3:10 PM",
      starred: false,
      patientId: "P008"
    },
    {
      id: 9,
      name: "James Taylor",
      type: "folder",
      date: "20 Jun 2024 at 11:55 AM",
      starred: true,
      patientId: "P009"
    },
    {
      id: 10,
      name: "Jennifer White",
      type: "folder",
      date: "15 Jun 2024 at 4:30 PM",
      starred: false,
      patientId: "P010"
    },
    {
      id: 11,
      name: "Michael Chen",
      type: "folder",
      date: "8 Jun 2024 at 1:25 PM",
      starred: true,
      patientId: "P011"
    },
    {
      id: 12,
      name: "Amanda Clark",
      type: "folder",
      date: "2 Jun 2024 at 7:40 AM",
      starred: false,
      patientId: "P012"
    }
  ];

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setFiles(sampleFiles);
      setFilteredFiles(sampleFiles);
      setLoading(false);
    }, 1000);
  }, []);

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

  if (loading) {
    return (
      <div className="w-full h-full bg-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Files</h1>
          <p className="text-gray-600">Manage and organize patient documents and medical records</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search patient files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Files Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
              onClick={() => {
                // Navigate to patient profile
                navigate(`/patient-profile/${file.patientId}`);
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

        {/* Empty State */}
        {filteredFiles.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No files found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search terms or browse all files.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientFiles;
