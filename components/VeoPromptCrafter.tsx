
import React, { useState } from 'react';
import { Loader2, Plus, Trash2, Users, Film, Video, Download, AlertCircle, Ratio } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { VEO_PROMPT_DATA } from '../constants';
import { copyToClipboard, delay } from '../utils';

interface SubjectData {
    id: number;
    description: string;
    dialogue: string;
}

const VeoPromptCrafter: React.FC = () => {
    // Dynamic Subject State
    const [subjects, setSubjects] = useState<SubjectData[]>([{ id: 1, description: '', dialogue: '' }]);
    
    // Existing State
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [promptId, setPromptId] = useState('');
    const [promptEn, setPromptEn] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copyStatus, setCopyStatus] = useState('');

    // Veo Generation State
    const [isVideoGenerating, setIsVideoGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [selectedRatio, setSelectedRatio] = useState<string>('16:9'); // Default Landscape

    const handleInputChange = (key: string, value: string) => {
        setInputs(prev => ({ ...prev, [key]: value }));
        setCopyStatus('');
    };

    // Subject Handlers
    const handleAddSubject = () => {
        if (subjects.length < 10) {
            setSubjects(prev => [...prev, { id: prev.length + 1, description: '', dialogue: '' }]);
        }
    };

    const handleRemoveSubject = (index: number) => {
        if (subjects.length > 1) {
            setSubjects(prev => prev.filter((_, i) => i !== index));
        }
    };

    const updateSubject = (index: number, field: 'description' | 'dialogue', value: string) => {
        setSubjects(prev => {
            const newSubjects = [...prev];
            newSubjects[index][field] = value;
            return newSubjects;
        });
    };

    const assembleIndonesianPrompt = (values: Record<string, string>, currentSubjects: SubjectData[]) => {
        // Construct Subject Descriptions
        const subjectDescriptions = currentSubjects
            .map((s, idx) => `Subjek ${idx + 1}: ${s.description || 'Tidak dideskripsikan'}`)
            .join('; ');

        const subjectDialogues = currentSubjects
            .filter(s => s.dialogue.trim() !== '')
            .map((s, idx) => `Subjek ${idx + 1} berkata: "${s.dialogue}"`)
            .join('. ');

        const action = values.action || "melakukan suatu aksi";
        const expression = values.expression ? `, dengan ekspresi ${values.expression}` : "";
        const place = values.place ? ` ${values.place}` : "";
        
        // Find label for time selection
        const timeOption = VEO_PROMPT_DATA.time.options?.find(o => o.value === values.time);
        const time = values.time ? ` (${timeOption?.label || values.time})` : "";
        
        let core = `Adegan menampilkan ${currentSubjects.length} subjek. ${subjectDescriptions}. Aksi: ${action}${expression}${place}.`;
        
        let details = "\n\nDetail Teknis:";
        
        const getLabel = (key: string, val: string) => 
            VEO_PROMPT_DATA[key].options?.find(o => o.value === val)?.label || val || 'Tidak Ditentukan';

        details += `\n- Waktu: ${time}`;
        details += `\n- Gerakan Kamera: ${getLabel('camera_motion', values.camera_motion)}`;
        details += `\n- Pencahayaan: ${getLabel('lighting', values.lighting)}`;
        details += `\n- Gaya Video: ${getLabel('video_style', values.video_style)}`;
        details += `\n- Suasana: ${getLabel('video_vibe', values.video_vibe)}`;

        let soundAndDialogue = "";
        if (values.sound_music) soundAndDialogue += `\n\nSuara/Musik (SFX): ${values.sound_music}.`;
        
        // Combine subject specific dialogues
        if (subjectDialogues) {
            soundAndDialogue += `\n\nDialog Karakter: ${subjectDialogues}`;
        }

        let additional = "";
        if (values.additional_details) additional += `\n\nDetail Tambahan: ${values.additional_details}.`;

        return core + details + soundAndDialogue + additional;
    };
    
    const assembleEnglishPrompt = (values: Record<string, string>, currentSubjects: SubjectData[], _indonesianText: string) => {
        // Build English Subject Strings
        const subjectList = currentSubjects
            .filter(s => s.description.trim() !== '')
            .map(s => s.description)
            .join(' and ');
        
        const dialogueList = currentSubjects
            .filter(s => s.dialogue.trim() !== '')
            .map(s => `character says "${s.dialogue}"`)
            .join(', then ');

        const core = [
            subjectList || "Multiple subjects", 
            values.action, 
            values.place
        ].filter(v => v && v.length > 0).join(' ');

        const modifiers: string[] = [];
        if (values.expression) modifiers.push(`with an ${values.expression} expression`);
        if (values.time) modifiers.push(values.time);
        if (values.lighting) modifiers.push(values.lighting);
        if (values.video_style) modifiers.push(values.video_style);
        if (values.video_vibe) modifiers.push(values.video_vibe);
        if (values.camera_motion) modifiers.push(values.camera_motion);
        if (values.additional_details) modifiers.push(values.additional_details);
        
        modifiers.push("highly detailed, cinematic, high quality, 8K");

        let finalPrompt = core;
        if (modifiers.length > 0) {
            finalPrompt += ', ' + modifiers.join(', ');
        }

        let soundAndDialogueEN = "";
        if (values.sound_music) soundAndDialogueEN += ` (Sound Design: ${values.sound_music})`;
        if (dialogueList) soundAndDialogueEN += ` (Dialogue: ${dialogueList})`;
        
        return finalPrompt.trim().replace(/\s*,\s*,/g, ', ').replace(/, \./g, '. ') + soundAndDialogueEN;
    };

    const handleGenerate = () => {
        setCopyStatus('');
        const hasSubject = subjects.some(s => s.description.trim() !== '');
        
        if (!hasSubject && !inputs.action) {
            setPromptId("Harap isi minimal 1 Subjek atau Aksi/Tindakan.");
            setPromptEn("");
            return;
        }

        setIsGenerating(true);
        setTimeout(() => {
            const pid = assembleIndonesianPrompt(inputs, subjects);
            const pen = assembleEnglishPrompt(inputs, subjects, pid);

            setPromptId(pid);
            setPromptEn(pen);
            setIsGenerating(false);
            
            copyToClipboard(pen);
            setCopyStatus("✅ Prompt Inggris Berhasil Disalin!");
            setTimeout(() => setCopyStatus(''), 3000);
        }, 200);
    };

    const handleUpdateAndCopy = () => {
        const values = inputs;
        const newPromptId = promptId;
        const newPromptEnFromInputs = assembleEnglishPrompt(values, subjects, newPromptId);

        setPromptEn(newPromptEnFromInputs);
        copyToClipboard(newPromptEnFromInputs);
        setCopyStatus("✅ Prompt Inggris (di-update) Berhasil Disalin!");
        setTimeout(() => setCopyStatus(''), 3000);
    };

    const handleGenerateVeoVideo = async () => {
        if (!promptEn) return;

        // Check for API Key selection (required for Veo)
        if ((window as any).aistudio && !await (window as any).aistudio.hasSelectedApiKey()) {
            await (window as any).aistudio.openSelectKey();
            // Proceed assuming key was selected, or user will re-click
        }

        setIsVideoGenerating(true);
        setVideoError(null);
        setVideoUrl(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Ensure resolution is appropriate for the aspect ratio if needed, though 1080p works for both usually in preview
            // But Veo guidelines often say 720p is safer/faster for preview models
            
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: promptEn,
                config: {
                    numberOfVideos: 1,
                    resolution: '1080p', 
                    aspectRatio: selectedRatio
                }
            });

            // Polling loop
            while (!operation.done) {
                await delay(5000);
                operation = await ai.operations.getVideosOperation({operation});
            }

            // Robust error checking
            if (operation.error) {
                throw new Error(operation.error.message || "Unknown Veo API Error");
            }

            // Fallback for response location (response or result)
            const videoResponse = operation.response || (operation as any).result;
            const uri = videoResponse?.generatedVideos?.[0]?.video?.uri;

            if (uri) {
                // Fetch the video blob using the key
                const vidResp = await fetch(`${uri}&key=${process.env.API_KEY}`);
                if (!vidResp.ok) throw new Error("Gagal mengunduh data video dari server Google.");
                const blob = await vidResp.blob();
                const blobUrl = URL.createObjectURL(blob);
                setVideoUrl(blobUrl);
            } else {
                console.error("Operation Debug:", operation);
                throw new Error("Video berhasil diproses, namun URL download tidak ditemukan dalam respon API.");
            }

        } catch (err: any) {
            console.error("Veo Error:", err);
            let msg = err.message || "Terjadi kesalahan saat membuat video.";
             if (JSON.stringify(err).includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
                msg = "Kuota API Habis (429 Resource Exhausted). Harap periksa Billing/Kuota API Key Anda atau tunggu beberapa saat.";
            }
            setVideoError(msg);
        } finally {
            setIsVideoGenerating(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="p-6 bg-gray-100/80 rounded-2xl shadow-xl border border-gray-300/50 backdrop-blur-sm mb-8">
                <h2 className="text-2xl font-semibold mb-6 text-emerald-600 border-b border-gray-300/50 pb-2 flex items-center gap-2">
                    <Users className="w-6 h-6" />
                    Input Komponen Prompt
                </h2>
                
                {/* 1. Multi-Subject Section */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-lg font-bold text-gray-800">
                            1. Subjek & Dialog (Maksimal 10)
                        </label>
                        {subjects.length < 10 && (
                            <button
                                onClick={handleAddSubject}
                                className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-emerald-700 transition"
                            >
                                <Plus className="w-4 h-4" /> Tambah Subjek
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {subjects.map((subj, index) => (
                            <div key={index} className="bg-white p-4 rounded-xl border border-gray-300 shadow-sm relative group">
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                        Subjek #{index + 1}
                                    </span>
                                    {subjects.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveSubject(index)}
                                            className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition"
                                            title="Hapus Subjek"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Deskripsi Visual Subjek</label>
                                        <input
                                            type="text"
                                            value={subj.description}
                                            onChange={(e) => updateSubject(index, 'description', e.target.value)}
                                            placeholder="Contoh: Seekor kucing merah memakai kacamata"
                                            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-emerald-400 focus:border-emerald-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Custom Dialog (Opsional)</label>
                                        <input
                                            type="text"
                                            value={subj.dialogue}
                                            onChange={(e) => updateSubject(index, 'dialogue', e.target.value)}
                                            placeholder="Contoh: 'Halo, nama saya Budi!'"
                                            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-purple-400 focus:border-purple-400 bg-purple-50/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Generic Options Loop */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.keys(VEO_PROMPT_DATA).map(key => {
                        const data = VEO_PROMPT_DATA[key];
                        return (
                            <div key={key} className="flex flex-col space-y-2">
                                <label htmlFor={key} className="text-sm font-semibold text-gray-800">
                                    {data.label}
                                </label>
                                
                                {data.type === 'text' ? (
                                    <input
                                        type="text"
                                        id={key}
                                        name={key}
                                        placeholder={data.placeholder}
                                        value={inputs[key] || ''}
                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                        className="w-full p-3 text-sm text-gray-900 bg-white/80 rounded-lg border border-gray-400 focus:ring-emerald-400 focus:border-emerald-400 transition duration-200"
                                    />
                                ) : (
                                    <select
                                        id={key}
                                        name={key}
                                        value={inputs[key] || ''}
                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                        className="w-full p-3 text-sm text-gray-900 bg-white/80 rounded-lg border border-gray-400 focus:ring-emerald-400 focus:border-emerald-400 transition duration-200 appearance-none cursor-pointer"
                                    >
                                        <option value="">--- Pilih Opsi ---</option>
                                        {data.options?.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`w-full text-white font-bold py-3 px-6 rounded-xl transition duration-300 ease-in-out shadow-lg flex justify-center items-center 
                            ${isGenerating
                                ? 'bg-gray-400 cursor-not-allowed text-gray-700' 
                                : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(52,211,153,0.7)] shadow-emerald-900/50'
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin text-white" />
                                Processing...
                            </>
                        ) : (
                            'Generate Prompt Awal'
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Kolom Kiri: Hasil Prompt */}
                <div className="p-6 bg-gray-100/80 rounded-2xl shadow-xl border border-gray-300/50 backdrop-blur-sm flex flex-col h-full">
                    <h2 className="text-2xl font-semibold mb-4 text-purple-600 border-b border-gray-300/50 pb-2">
                        Prompt Hasil & Finalisasi
                    </h2>
                    
                    <div className="space-y-4 flex-grow">
                        <div>
                            <label htmlFor="output-prompt-id" className="text-sm font-medium text-gray-800">
                                Prompt Bahasa Indonesia (Edit & Kembangkan)
                            </label>
                            <textarea
                                id="output-prompt-id"
                                rows={6}
                                value={promptId}
                                onChange={(e) => setPromptId(e.target.value)}
                                className="w-full mt-2 p-3 text-sm text-gray-900 bg-white/80 rounded-lg border-2 border-dashed border-gray-400 focus:ring-emerald-400 focus:border-emerald-400 whitespace-pre-wrap resize-none"
                            ></textarea>
                        </div>

                        <div>
                            <label htmlFor="output-prompt-en" className="text-sm font-medium text-gray-800">
                                Prompt Bahasa Inggris (Final untuk Model)
                            </label>
                            <textarea
                                id="output-prompt-en"
                                rows={6}
                                readOnly
                                value={promptEn}
                                className="w-full mt-2 p-3 text-sm text-gray-900 bg-gray-200/80 rounded-lg border-2 border-dashed border-purple-600 whitespace-pre-wrap resize-none opacity-80 cursor-not-allowed"
                            ></textarea>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-300 flex flex-col gap-3">
                        <button
                            onClick={handleUpdateAndCopy}
                            disabled={!promptId || isGenerating}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition disabled:opacity-50"
                        >
                            Update & Salin Prompt Inggris
                        </button>
                        {copyStatus && (
                            <div className="text-center text-emerald-600 font-medium text-sm">
                                {copyStatus}
                            </div>
                        )}
                    </div>
                </div>

                {/* Kolom Kanan: Veo Generator */}
                <div className="p-6 bg-gray-900 rounded-2xl shadow-xl border border-gray-700 flex flex-col h-full">
                    <h2 className="text-2xl font-semibold mb-4 text-white border-b border-gray-700 pb-2 flex items-center gap-2">
                        <Video className="w-6 h-6 text-red-500" />
                        Veo 3 Video Generator
                    </h2>

                    <div className="flex-grow flex flex-col justify-center items-center bg-gray-800 rounded-xl border border-gray-700 overflow-hidden min-h-[300px] relative">
                        {videoUrl ? (
                            <div className="w-full h-full flex flex-col">
                                <video 
                                    src={videoUrl} 
                                    controls 
                                    autoPlay 
                                    loop 
                                    className="w-full h-auto max-h-[400px] object-contain bg-black"
                                />
                                <div className="p-4 bg-gray-800 flex justify-center">
                                    <a 
                                        href={videoUrl} 
                                        download="veo-generated-video.mp4"
                                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-full font-bold transition shadow-lg shadow-emerald-900/50"
                                    >
                                        <Download className="w-4 h-4" /> Download Video
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-8">
                                {isVideoGenerating ? (
                                    <div className="flex flex-col items-center">
                                        <div className="relative w-20 h-20 mb-4">
                                            <div className="absolute inset-0 rounded-full border-4 border-gray-600"></div>
                                            <div className="absolute inset-0 rounded-full border-4 border-t-red-500 animate-spin"></div>
                                            <Film className="absolute inset-0 m-auto w-8 h-8 text-white animate-pulse" />
                                        </div>
                                        <p className="text-white font-bold text-lg animate-pulse">Sedang Membuat Video...</p>
                                        <p className="text-gray-400 text-sm mt-2">Mohon tunggu, proses ini memakan waktu 1-2 menit.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center opacity-50">
                                        <Film className="w-16 h-16 text-gray-500 mb-4" />
                                        <p className="text-gray-300 font-medium">Video akan muncul di sini</p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {videoError && (
                            <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 text-red-100 p-3 rounded-lg text-sm border border-red-500 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                {videoError}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col gap-4">
                         {/* Aspect Ratio Selector */}
                        <div>
                            <label className="text-gray-400 text-xs font-semibold uppercase mb-1 block flex items-center gap-1">
                                <Ratio className="w-3 h-3"/> Aspect Ratio
                            </label>
                            <select
                                value={selectedRatio}
                                onChange={(e) => setSelectedRatio(e.target.value)}
                                className="w-full p-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                                disabled={isVideoGenerating}
                            >
                                <option value="16:9">Landscape (16:9) - Youtube/TV</option>
                                <option value="9:16">Portrait (9:16) - TikTok/Reels/Shorts</option>
                            </select>
                        </div>

                        <button
                            onClick={handleGenerateVeoVideo}
                            disabled={!promptEn || isVideoGenerating || isGenerating}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition duration-300 flex items-center justify-center gap-2
                                ${!promptEn || isVideoGenerating || isGenerating
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-red-900/40'
                                }`}
                        >
                            {isVideoGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Film className="w-5 h-5" />
                                    Generate Video (Veo 3)
                                </>
                            )}
                        </button>
                        <p className="text-xs text-gray-500 text-center">
                            *Menggunakan prompt bahasa Inggris di sebelah kiri.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VeoPromptCrafter;
