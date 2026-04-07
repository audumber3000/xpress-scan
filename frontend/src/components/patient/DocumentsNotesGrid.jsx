import React from 'react';
import { FileText, Image as ImageIcon, Activity, FileDigit } from 'lucide-react';

const getFileIcon = (type) => {
  const ext = type?.toLowerCase();
  if (ext === 'pdf') return <FileText className="text-red-500" />;
  if (['png', 'jpg', 'jpeg'].includes(ext)) return <ImageIcon className="text-blue-500" />;
  if (['dcm', 'rvg'].includes(ext)) return <Activity className="text-purple-500" />;
  return <FileDigit className="text-gray-400" />;
};

const DocumentsNotesGrid = ({
  patientDocuments,
  form,
  onFormChange,
  onUploadClick
}) => {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-8 border-t border-gray-100">
      {/* Documents Column */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon size={20} className="text-[#2a276e]" />
            Documents & Scans
          </h3>
          <button 
            onClick={onUploadClick}
            className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
          >
            + Upload
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
          {patientDocuments.length > 0 ? (
            patientDocuments.map(doc => (
              <a 
                key={doc.id}
                href={doc.file_path}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 w-24 flex flex-col items-center gap-2 group"
              >
                <div className="w-full aspect-square bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center group-hover:border-[#2a276e] group-hover:shadow-lg transition-all duration-300">
                  <div className="scale-125 transition-transform group-hover:scale-150 duration-500">
                    {getFileIcon(doc.file_type)}
                  </div>
                </div>
                <p className="text-[10px] font-bold text-gray-500 truncate w-full text-center group-hover:text-[#2a276e]">{doc.file_name}</p>
              </a>
            ))
          ) : (
            <div 
              onClick={onUploadClick}
              className="w-full h-24 rounded-2xl border-2 border-dashed border-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer"
            >
              <p className="text-sm text-gray-500">No documents uploaded</p>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Observations Column */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Activity size={20} className="text-[#2a276e]" />
            Clinical Notes
          </h3>
        <textarea 
          value={form.notes}
          onChange={(e) => onFormChange({...form, notes: e.target.value})}
          placeholder="Refined observations for this session..."
          className="w-full px-6 py-5 bg-gray-50 border border-gray-200 rounded-3xl focus:border-[#2a276e] outline-none text-sm font-medium min-h-[140px] resize-none transition-all shadow-inner"
        />
      </div>
    </section>
  );
};

export default DocumentsNotesGrid;
