import React, { useState } from 'react';
import { Sparkles, Download, RefreshCw, Image as ImageIcon, AlertCircle, Loader2, Wand2, Edit, Lightbulb, ThumbsUp, ThumbsDown, Move, Eye, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai'; // Import GoogleGenAI
import { downloadImage } from '../utils'; // Import downloadImage utility

const CharacterGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [feedback, setFeedback] = useState<string | null>(null); 
  const [showPreview, setShowPreview] = useState(false); 
  
  const [pose, setPose] = useState('front view, looking at camera');

  // Daftar opsi posisi dengan mapping ke prompt bahasa Inggris
  const poseOptions = [
    { label: 'Menghadap Kedepan', value: 'front view, looking at camera' },
    { label: 'Menghadap Ke Kiri', value: 'side profile view facing left' },
    { label: 'Menghadap Ke Kanan', value: 'side profile view facing right' },
    { label: 'Nyerong Kekiri', value: 'three-quarter view facing left' },
    { label: 'Nyerong Ke Kanan', value: 'three-quarter view facing right' },
  ];

  const generateImage = async (currentPrompt: string) => {
    if (!currentPrompt.trim()) {
      setError('Harap masukkan deskripsi karakter terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError('');
    setFeedback(null); 
    setImage(null); // Clear previous image for new generation

    // Technique "Prompt Engineering"
    const realismBoost = "photorealistic, hyper-realistic, 8k resolution, highly detailed texture, skin pores, cinematic lighting, raw photo, masterpiece, sharp focus, photography";
    
    // Adding pose to the final prompt
    const finalPrompt = `${currentPrompt}, ${pose}, ${realismBoost}`;

    try {
      // Initialize GoogleGenAI here to ensure it uses the latest API_KEY
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const response = await ai.models.generateImages({
          model: 'imagen-4.0-generate-001',
          prompt: finalPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio,
          },
      });
      
      if (response.generatedImages && response.generatedImages[0]?.image?.imageBytes) {
        const imageUrl = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
        setImage(imageUrl);
      } else {
        throw new Error('Format respon tidak dikenali atau tidak ada gambar yang dihasilkan.');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat menghubungi server AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateClick = () => {
    generateImage(prompt);
  };

  const handleEditClick = () => {
    // For edit, we effectively regenerate with an appended prompt
    generateImage(`${prompt}, ${editPrompt}`); 
  };

  const handleDownload = () => {
    if (image) {
      // Extract base64 data from the data URL
      const base64Data = image.split(',')[1];
      downloadImage(base64Data, `karakter-realistis-${Date.now()}.png`);
    }
  };

  const enhancePrompt = () => {
    const enhancements = [
      "wearing futuristic armor, neon lights background",
      "portrait close-up, studio lighting, bokeh background",
      "standing in a cybercity street, rain, reflection",
      "medieval fantasy attire, intricate details, forest background"
    ];
    const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    setPrompt(prev => prev ? `${prev}, ${randomEnhancement}` : randomEnhancement);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
      
      {/* Kolom Kontrol (Input) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="p-6 bg-gray-100/80 rounded-2xl shadow-xl border border-gray-300/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4 border-b border-gray-300/50 pb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-emerald-600">
              <Wand2 className="w-4 h-4 text-emerald-600" />
              Deskripsi Karakter
            </h2>
            <button 
              onClick={enhancePrompt}
              className="text-xs text-purple-600 hover:text-purple-500 hover:underline flex items-center gap-1"
              title="Tambahkan detail acak"
            >
              + Ide
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 font-medium mb-2">Prompt (Inggris disarankan)</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Contoh: A warrior woman with silver hair, detailed armor, scar on cheek, intense look..."
                className="w-full h-24 bg-white/80 border border-gray-400 rounded-lg p-3 text-sm focus:ring-emerald-400 focus:border-emerald-400 outline-none transition-all resize-none placeholder:text-gray-500"
              />
            </div>

            {/* Menu Pilihan Posisi Model */}
            <div>
              <label className="block text-sm text-gray-700 font-medium mb-2 flex items-center gap-2">
                <Move className="w-3 h-3" /> Posisi Model
              </label>
              <div className="grid grid-cols-2 gap-2">
                {poseOptions.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => setPose(option.value)}
                    className={`py-2 px-3 text-xs rounded-lg border transition-all ${
                      pose === option.value
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20'
                        : 'bg-gray-200/80 border-gray-400 text-gray-700 hover:bg-gray-300'
                    } ${index === 0 ? 'col-span-2 font-medium' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
               <label className="block text-sm text-gray-700 font-medium mb-2">Rasio (Simulasi)</label>
               <div className="grid grid-cols-4 gap-2">
                  {['1:1', '3:4', '16:9', '9:16'].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-2 text-xs rounded-lg border transition-all ${
                        aspectRatio === ratio 
                          ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20' 
                          : 'bg-gray-200/80 border-gray-400 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
               </div>
            </div>

            <button
              onClick={handleGenerateClick}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-900/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sedang Membuat...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Karakter
                </>
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-100/70 border border-red-400/50 rounded-lg text-red-700 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Edit Panel */}
        {image && !loading && (
          <div className="p-6 bg-gray-100/80 rounded-2xl shadow-xl border border-gray-300/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4 border-b border-gray-300/50 pb-2">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-purple-600">
                <Edit className="w-4 h-4 text-purple-600" />
                Edit Gambar
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 font-medium mb-2">Perintah Edit</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Contoh: change hair color to blue, add a sword, make her smile..."
                  className="w-full h-24 bg-white/80 border border-gray-400 rounded-lg p-3 text-sm focus:ring-purple-400 focus:border-purple-400 outline-none transition-all resize-none placeholder:text-gray-500"
                />
              </div>
              <button
                onClick={handleEditClick}
                disabled={loading || !editPrompt.trim()}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold shadow-lg shadow-purple-900/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Menerapkan Edit...
                  </>
                ) : (
                  <>
                    <Edit className="w-5 h-5" />
                    Terapkan Edit
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="bg-blue-100/70 border-l-4 border-blue-400 p-3 mb-6 rounded-lg text-sm text-blue-800 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <ul className="list-disc pl-4 space-y-1">
            <li>**Tips Posisi:** Pilihan posisi akan digabungkan otomatis dengan deskripsi Anda.</li>
            <li>**Tips Prompt Realistis:** Gunakan kata kunci spesifik (contoh: "blue eyes", "leather texture").</li>
          </ul>
        </div>
      </div>

      {/* Area Display Gambar */}
      <div className="lg:col-span-3">
        <div className={`h-full min-h-[500px] bg-gray-100/80 border border-gray-300/50 rounded-2xl flex flex-col relative overflow-hidden group ${loading ? 'animate-pulse' : ''}`}>
          
          {/* Canvas Container */}
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
            {image ? (
              <div className="relative max-w-full max-h-[600px] shadow-2xl rounded-lg overflow-hidden">
                  <img 
                    src={image} 
                    alt="Generated Character" 
                    className="w-full h-full object-contain"
                  />
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="w-10 h-10 opacity-50 text-gray-400" />
                </div>
                <p className="text-lg font-medium mb-2">Belum ada gambar</p>
                <p className="text-sm max-w-xs mx-auto">Tulis deskripsi karakter dan pilih posisi model di panel sebelah kiri.</p>
              </div>
            )}
          </div>

          {/* Loading Overlay */}
          {loading && (
             <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
                  </div>
                </div>
                <p className="mt-4 text-emerald-700 font-medium animate-pulse">AI sedang melukis...</p>
             </div>
          )}

          {/* Action Bar */}
          {image && !loading && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-100 via-gray-100/90 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Gambar dihasilkan oleh Imagen 4.0</span>
                
                {/* Review Buttons */}
                <div className="flex items-center ml-2 border border-gray-300 rounded-full p-1">
                  <button 
                    onClick={() => setFeedback('like')}
                    className={`p-1 rounded-full transition-all ${
                      feedback === 'like' ? 'bg-green-600 text-white' : 'hover:bg-green-700/50 text-gray-500 hover:text-green-600'
                    }`}
                    title="Suka"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setFeedback('dislike')}
                    className={`p-1 rounded-full transition-all ${
                      feedback === 'dislike' ? 'bg-red-600 text-white' : 'hover:bg-red-700/50 text-gray-500 hover:text-red-600'
                    }`}
                    title="Tidak Suka"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowPreview(true)}
                  className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                  title="Lihat Layar Penuh"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => { setImage(null); setPrompt(''); setEditPrompt(''); setFeedback(null); }}
                  className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                  title="Hapus gambar dan mulai baru"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleDownload}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-900/20 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Unduh HD
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Preview Fullscreen */}
      {showPreview && image && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowPreview(false)}>
          <button
            onClick={() => setShowPreview(false)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-7xl max-h-screen w-full h-full flex items-center justify-center p-4">
             <img
              src={image}
              alt="Full Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterGenerator;