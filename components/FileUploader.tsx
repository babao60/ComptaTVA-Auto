import React, { ChangeEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploaderProps {
  onFileUpload: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, accept = ".csv, .txt, .tsv, .pdf", multiple = false }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <UploadCloud className="w-12 h-12 mb-4 text-slate-400" />
          <p className="mb-2 text-sm text-slate-500">
            <span className="font-semibold">Cliquez pour téléverser</span> ou glissez-déposez
          </p>
          <p className="text-xs text-slate-500">
            {multiple ? "Sélectionnez plusieurs fichiers PDF" : "Sélectionnez un fichier (CSV/TXT)"}
          </p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange} 
        />
      </label>
    </div>
  );
};