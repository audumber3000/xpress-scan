import React from 'react';
import { FileText, Image as ImageIcon, Activity, FileDigit, UploadCloud } from 'lucide-react';

const iconFor = (type) => {
  const ext = (type || '').toLowerCase();
  if (ext === 'pdf') return <FileText className="text-red-500" size={22} />;
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return <ImageIcon className="text-blue-500" size={22} />;
  if (['dcm', 'rvg'].includes(ext)) return <Activity className="text-purple-500" size={22} />;
  return <FileDigit className="text-gray-400" size={22} />;
};

const DocumentsTab = ({ documents = [], onUploadClick }) => {
  if (!documents.length) {
    return (
      <button
        type="button"
        onClick={onUploadClick}
        className="w-full py-12 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer transition-[background-color,border-color] duration-150 ease-out hover:bg-gray-50 hover:border-gray-300"
      >
        <UploadCloud size={26} className="text-gray-300" />
        <span className="text-sm font-semibold text-gray-500">No documents yet</span>
        <span className="text-xs text-gray-400">X-rays, scans and reports for this visit go here</span>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {documents.map((doc) => (
        <a
          key={doc.id}
          href={doc.file_path}
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col items-center gap-1.5"
        >
          <span className="w-full aspect-square bg-white rounded-xl border border-gray-200 flex items-center justify-center transition-[border-color] duration-150 ease-out group-hover:border-[#2a276e]">
            {iconFor(doc.file_type)}
          </span>
          <span className="w-full text-[10px] font-semibold text-gray-500 text-center truncate transition-colors duration-150 group-hover:text-[#2a276e]">
            {doc.file_name}
          </span>
        </a>
      ))}
    </div>
  );
};

export default DocumentsTab;
