import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import GearLoader from '../GearLoader';
import { toast } from 'react-toastify';

const PatientFilesTab = ({ patientId }) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const fetchFiles = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/xray/patient/${patientId}`);
            setFiles(response || []);
        } catch (error) {
            console.error('Error fetching patient files:', error);
            toast.error('Failed to load patient files.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (patientId) fetchFiles();
    }, [patientId]);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Basic validation
        if (!file.name.endsWith('.dcm')) {
            toast.error('Please upload a DICOM (.dcm) file.');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('patient_id', patientId);
            formData.append('image_type', 'panoramic'); // Default type

            await api.post('/xray/upload', formData);

            toast.success('File uploaded successfully.');
            fetchFiles();
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Failed to upload file.');
        } finally {
            setUploading(false);
        }
    };

    const deleteFile = async (xrayId) => {
        if (!window.confirm('Are you sure you want to delete this file?')) return;

        try {
            await api.delete(`/xray/${xrayId}`);
            toast.success('File deleted.');
            fetchFiles();
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Failed to delete file.');
        }
    };

    if (loading) return <div className="py-20 flex justify-center"><GearLoader /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Patient Imaging & Files</h3>
                    <p className="text-sm text-gray-500">DICOM X-rays and clinical attachments</p>
                </div>
                <label className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-lg ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-[#2a276e] text-white hover:bg-[#1a1548] shadow-blue-900/10'
                    }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                    {uploading ? 'Uploading...' : 'Upload DICOM'}
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".dcm" disabled={uploading} />
                </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {files.length > 0 ? (
                    files.map((file) => (
                        <div key={file.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl transition-all">
                            <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                                <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                    <button className="p-2 bg-white rounded-full text-[#2a276e] hover:scale-110 transition-transform">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => deleteFile(file.id)}
                                        className="p-2 bg-white rounded-full text-red-600 hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <h4 className="font-bold text-gray-900 truncate">{file.file_name}</h4>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{file.image_type}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        {new Date(file.capture_date).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <h4 className="text-gray-900 font-bold">No Clinical Images</h4>
                        <p className="text-gray-500 text-sm">Upload DICOM X-rays or other diagnostic files for this patient.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientFilesTab;
