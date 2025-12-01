import React from 'react';
import { Globe, ExternalLink, Loader2 } from 'lucide-react';

const GoogleFlowPanel: React.FC = () => {
    return (
        <div className="max-w-6xl mx-auto h-full">
             <div className="p-6 bg-gray-100/80 rounded-2xl shadow-xl border border-gray-300/50 backdrop-blur-sm h-[85vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-gray-300/50 pb-2">
                    <h2 className="text-2xl font-semibold text-emerald-600 flex items-center">
                        <Globe className="w-6 h-6 mr-2" />
                        Google Labs: Flow (Browser)
                    </h2>
                    <a 
                        href="https://labs.google/flow/about" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center"
                    >
                        Buka di Tab Baru <ExternalLink className="w-4 h-4 ml-2"/>
                    </a>
                </div>
                
                <div className="flex-grow bg-white rounded-xl border border-gray-300 overflow-hidden relative group">
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-0 bg-gray-50 text-gray-500 p-8 text-center">
                        <Loader2 className="w-10 h-10 mb-4 text-gray-300 animate-spin" />
                        <p className="mb-2 font-semibold">Memuat Google Labs Flow...</p>
                        <p className="text-sm max-w-md">
                            Jika layar tetap kosong atau menampilkan error "Refused to connect", itu berarti Google memblokir akses embedding di dalam aplikasi ini.
                        </p>
                        <a 
                            href="https://labs.google/flow/about" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-4 text-emerald-600 hover:underline font-medium"
                        >
                            Silakan klik di sini untuk membuka langsung.
                        </a>
                    </div>

                    <iframe 
                        src="https://labs.google/flow/about" 
                        className="w-full h-full relative z-10 bg-transparent"
                        title="Google Labs Flow"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    />
                </div>
            </div>
        </div>
    );
};

export default GoogleFlowPanel;