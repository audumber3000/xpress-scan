import React, { useState, useRef } from 'react';
import { api } from '../../utils/api';
import { toast } from 'react-toastify';

const ScanUploadDrawer = ({ isOpen, onClose, onUpload, patientId, casePaperId }) => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [tag, setTag] = useState('X-Ray');
    const [notes, setNotes] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...files]);
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0 || !patientId) return;
        setIsUploading(true);
        try {
            const uploadPromises = selectedFiles.map(async (file) => {
                const formData = new FormData();
                formData.append('file', file);
                
                const url = casePaperId 
                    ? `/documents/upload/${patientId}?case_paper_id=${casePaperId}`
                    : `/documents/upload/${patientId}`;
                
                return await api.post(url, formData);
            });
            
            await Promise.all(uploadPromises);
            onUpload({ files: selectedFiles, tag, notes });
            setSelectedFiles([]);
            setNotes('');
            onClose();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload files');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity" onClick={onClose}></div>
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[70] transform transition-transform duration-300 flex flex-col translate-x-0">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Upload Scans & Documents</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Select Category</label>
                        <div className="flex flex-wrap gap-2">
                            {['X-Ray', 'RVG', 'OPG', 'CBCT', 'Intra-Oral', 'Report', 'Consent'].map(t => (
                                <button key={t} onClick={() => setTag(t)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                        tag === t 
                                        ? 'bg-[#2a276e] text-white border-[#2a276e] shadow-md' 
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Files</label>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept="image/*,.pdf" />
                        
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full aspect-[2/1] border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-[#2a276e]/30 transition-all group"
                        >
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#2a276e]/5 transition-all text-gray-400 group-hover:text-[#2a276e]">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            </div>
                            <p className="text-sm font-bold text-gray-700">Click to Browse or Drop Files</p>
                            <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG, PDF up to 10MB</p>
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="mt-6 space-y-2 animate-fade-in">
                                {selectedFiles.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 text-[#2a276e]">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 truncate max-w-[180px]">{f.name}</p>
                                                <p className="text-[10px] text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFile(i)} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2 font-bold uppercase tracking-wider">Clinical Notes</label>
                        <textarea 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            rows={4} 
                            placeholder="Add findings or diagnosis for these scans..."
                            className="w-full bg-gray-50 border border-transparent hover:border-gray-200 focus:border-[#2a276e] focus:bg-white focus:ring-4 focus:ring-[#2a276e]/10 rounded-2xl px-4 py-3 text-sm transition-all text-gray-900 resize-none outline-none shadow-inner"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50">
                    <button 
                        onClick={handleUpload}
                        disabled={isUploading || selectedFiles.length === 0}
                        className={`w-full py-4 rounded-3xl font-bold transition-all shadow-md ${
                            !isUploading && selectedFiles.length > 0
                            ? 'bg-[#2a276e] hover:bg-[#1a1548] text-white hover:shadow-lg' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        {isUploading ? 'Uploading Scans...' : `Upload ${selectedFiles.length} File${selectedFiles.length === 1 ? '' : 's'}`}
                    </button>
                </div>
            </div>
        </>
    );
};

export default ScanUploadDrawer;
