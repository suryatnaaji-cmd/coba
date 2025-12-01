import React from 'react';
import { Upload, X } from 'lucide-react';

interface CustomFileInputProps {
    label: string;
    id: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    maxFiles?: number;
    preview: string | string[];
    multiple?: boolean;
    modelDescription?: string[];
    onModelDescriptionChange?: (index: number, value: string) => void;
    onDelete?: (index: number) => void;
}

const CustomFileInput: React.FC<CustomFileInputProps> = ({ 
    label, 
    id, 
    onChange, 
    maxFiles = 1, 
    preview, 
    multiple = false, 
    modelDescription, 
    onModelDescriptionChange, 
    onDelete 
}) => {
    const previewArray = Array.isArray(preview) ? preview : (preview ? [preview] : []);

    return (
        <div className="flex flex-col space-y-2 p-4 bg-gray-100/80 rounded-xl border border-gray-300/50 shadow-lg transition duration-300 hover:border-emerald-400">
            <label htmlFor={id} className="text-sm font-semibold text-gray-800">
                {label}
            </label>
            
            <div className="flex items-center space-x-3">
                <label htmlFor={id} className="cursor-pointer bg-emerald-600/70 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg transition duration-300 shadow-md shadow-emerald-700/30 flex items-center">
                    <Upload className="w-4 h-4 mr-2" />
                    Pilih File {multiple && previewArray.length > 0 ? `(${previewArray.length}/${maxFiles})` : ''}
                </label>
                <input
                    id={id}
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    multiple={multiple}
                    onChange={onChange}
                    className="hidden"
                />
            </div>

            {previewArray.map((src, index) => (
                <div key={index} className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-x-4 mt-2">
                    <div className="relative w-24 h-24 bg-gray-200 rounded-lg overflow-hidden border border-gray-400 flex-shrink-0">
                        <img src={`data:image/jpeg;base64,${src}`} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        {onDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(index)}
                                className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-500 text-white p-1 rounded-full shadow-md transition duration-200 z-10"
                                aria-label="Hapus gambar"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    {onModelDescriptionChange && (
                        <div className="w-full">
                             <label htmlFor={`model-desc-${index}`} className="text-xs font-medium text-gray-600 block mb-1">
                                Deskripsi Model {index + 1} (Opsional)
                            </label>
                            <textarea
                                id={`model-desc-${index}`}
                                rows={2}
                                value={(modelDescription && modelDescription[index]) || ''}
                                onChange={(e) => onModelDescriptionChange(index, e.target.value)}
                                placeholder="Contoh: perempuan berhijab formal, celana jeans biru, sepatu heels putih."
                                className="w-full p-2 text-sm text-gray-900 bg-white/80 rounded-lg border border-gray-400 focus:ring-emerald-400 focus:border-emerald-400 resize-none transition duration-200"
                            />
                        </div>
                    )}
                </div>
            ))}
            {onModelDescriptionChange && previewArray.length < maxFiles && (
                 <button
                    type="button"
                    onClick={() => document.getElementById(id)?.click()}
                    className="text-emerald-600 hover:text-emerald-500 text-sm font-medium transition duration-200 mt-2 text-left flex items-center"
                >
                    <span className="text-xl mr-1">+</span> Tambah Model ({previewArray.length}/{maxFiles})
                </button>
            )}
        </div>
    );
};

export default CustomFileInput;