import React, { useState, useMemo, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { VOICE_DATA } from '../constants';
import { base64ToArrayBuffer, pcmToWav } from '../utils';

// Constants
const SAMPLE_RATE = 24000;
const GENDER_MAP: Record<string, string> = { 'Laki-laki': 'Pria', 'Perempuan': 'Wanita', 'Netral': 'Netral', 'Semua': 'Semua' };
const STYLE_MAP: Record<string, string> = {
    'Pendidik/Pengajar': 'Pendidik',
    'Meyakinkan/Profesional': 'Meyakinkan',
    'Pelatih/Ceria': 'Pelatih',
    'Ekspresif secara Emosional': 'Ekspresif',
    'Semua': 'Semua',
    'Narator': 'Narator',
    'Motivator': 'Motivator'
};
const GENDER_FILTERS = ['Semua', 'Laki-laki', 'Perempuan', 'Netral'];
const STYLE_FILTERS = ['Semua', 'Narator', 'Pendidik/Pengajar', 'Meyakinkan/Profesional', 'Pelatih/Ceria', 'Motivator', 'Ekspresif secara Emosional'];

const TTSGenerator: React.FC = () => {
    const [activeGenderFilter, setActiveGenderFilter] = useState('Semua');
    const [activeStyleFilter, setActiveStyleFilter] = useState('Semua');
    const [selectedVoice, setSelectedVoice] = useState<string | null>(VOICE_DATA[0].name);
    const [textInput, setTextInput] = useState("Selamat datang! Mari kita dengarkan suara Kore yang tegas. Ingat, gunakan koma untuk jeda, dan tanda seru untuk penekanan!");
    const [charCount, setCharCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

    useEffect(() => {
        setCharCount(textInput.length);
    }, [textInput]);

    const filteredVoices = useMemo(() => {
        const mappedGender = GENDER_MAP[activeGenderFilter];
        const mappedStyle = STYLE_MAP[activeStyleFilter];

        const voices = VOICE_DATA.filter(voice => {
            const genderMatch = mappedGender === 'Semua' || voice.gender === mappedGender;
            const styleMatch = mappedStyle === 'Semua' || voice.style === mappedStyle;
            return genderMatch && styleMatch;
        });
        return voices;
    }, [activeGenderFilter, activeStyleFilter]);

    useEffect(() => {
        if (filteredVoices.length > 0) {
            const currentVoiceStillExists = selectedVoice && filteredVoices.some(v => v.name === selectedVoice);
            if (!currentVoiceStillExists) {
                setSelectedVoice(filteredVoices[0].name);
            }
        } else {
            setSelectedVoice(null);
        }
    }, [filteredVoices, selectedVoice]);

    const handleGenerateVoiceOver = async () => {
        setErrorMessage(null);
        setNotificationMessage(null);
        setAudioUrl(null);

        if (!selectedVoice) {
            setNotificationMessage('Harap pilih suara yang tersedia.');
            return;
        }
        if (textInput.trim().length === 0) {
            setNotificationMessage('Harap masukkan teks yang ingin Anda ubah menjadi suara.');
            return;
        }

        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [
                    { parts: [{ text: textInput.trim() }] }
                ],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: selectedVoice }
                        }
                    }
                }
            });
            
            // Extract the audio data from the response
            const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith("audio/"));
            
            if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
                throw new Error("Respons API tidak mengandung data audio yang valid.");
            }

            const audioData = audioPart.inlineData.data;

            const pcmBuffer = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmBuffer);
            const wavBlob = pcmToWav(pcm16, SAMPLE_RATE);
            const newAudioUrl = URL.createObjectURL(wavBlob);

            setAudioUrl(newAudioUrl);

        } catch (error: any) {
            console.error('Kesalahan saat membuat voice over:', error);
            setErrorMessage(`Gagal membuat suara. Detail: ${error.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="p-6 bg-gray-100/80 rounded-2xl shadow-xl border border-gray-300/50 backdrop-blur-sm mb-8">
                
                <h2 className="text-2xl font-semibold mb-4 text-emerald-600 border-b border-gray-300/50 pb-2 flex items-center">
                    <Mic className="w-6 h-6 mr-2" />
                    Generator Teks-ke-Suara (Gemini TTS)
                </h2>

                <div className="bg-blue-100/70 border-l-4 border-blue-400 p-3 mb-6 rounded-lg text-sm text-blue-800">
                    <p className="font-semibold mb-1">Tips Kontrol Suara (Nada, Intonasi, Tempo):</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Karakteristik teknis dikontrol melalui teks Anda (tanda baca, pemilihan kata) dan karakteristik bawaan dari setiap suara.</li>
                        <li>Gunakan koma (,) untuk jeda singkat dan tanda seru (!) untuk penekanan.</li>
                    </ul>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Gender:</label>
                    <div className="flex flex-wrap gap-2">
                        {GENDER_FILTERS.map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveGenderFilter(filter)}
                                className={`px-4 py-2 text-sm rounded-full border border-gray-300 transition-all duration-200 
                                    ${activeGenderFilter === filter 
                                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' 
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Karakter berdasarkan Gaya dan Kepribadian:</label>
                    <div className="flex flex-wrap gap-2">
                         {STYLE_FILTERS.map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveStyleFilter(filter)}
                                className={`px-4 py-2 text-sm rounded-full border border-gray-300 transition-all duration-200 
                                    ${activeStyleFilter === filter 
                                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' 
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label htmlFor="voice-select" className="block text-sm font-semibold text-gray-800 mb-2">
                        Pilihan Suara yang Tersedia (Hasil Filter):
                    </label>
                    <select 
                        id="voice-select" 
                        value={selectedVoice || ''}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        disabled={filteredVoices.length === 0}
                        className="w-full p-3 text-sm text-gray-900 bg-white/80 rounded-lg border border-gray-400 focus:ring-emerald-400 focus:border-emerald-400 transition duration-200 appearance-none cursor-pointer"
                    >
                        {filteredVoices.length > 0 ? (
                            filteredVoices.map(voice => (
                                <option key={voice.name} value={voice.name}>
                                    {`${voice.name} - ${voice.gender} (${voice.description})`}
                                </option>
                            ))
                        ) : (
                            <option value="" disabled>Tidak ada suara yang cocok dengan filter ini.</option>
                        )}
                    </select>
                </div>

                <div className="mb-6">
                    <label htmlFor="text-input-tts" className="block text-sm font-semibold text-gray-800 mb-2">
                        Teks untuk diubah menjadi Suara:
                    </label>
                    <textarea 
                        id="text-input-tts" 
                        placeholder="Masukkan teks di sini..." 
                        maxLength={500}
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        className="w-full p-4 border border-gray-400 rounded-lg focus:ring-emerald-400 focus:border-emerald-400 transition duration-150 ease-in-out min-h-[120px] resize-vertical bg-white/80" 
                        required
                    ></textarea>
                    <p className="text-xs text-gray-500 mt-1 text-right">{charCount}/500 karakter</p>
                </div>

                {notificationMessage && (
                    <div className="p-3 mb-4 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg border border-yellow-400">
                        {notificationMessage}
                    </div>
                )}

                <button 
                    id="generate-button-tts" 
                    onClick={handleGenerateVoiceOver}
                    disabled={isLoading || !selectedVoice}
                    className={`w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white transition duration-300
                        ${isLoading || !selectedVoice 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-lg shadow-emerald-900/50'
                        }`}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin mr-3" />
                            Memproses...
                        </>
                    ) : (
                        "Buat Voice Over"
                    )}
                </button>

                {(audioUrl || errorMessage) && (
                    <div className="mt-8 pt-4 border-t border-gray-300/50">
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">Hasil Suara:</h2>
                        
                        {audioUrl && (
                            <>
                                <audio 
                                    id="audio-player" 
                                    key={audioUrl}
                                    controls 
                                    src={audioUrl}
                                    className="w-full bg-gray-200 rounded-lg shadow-md"
                                >
                                    Browser Anda tidak mendukung elemen audio.
                                </audio>
                                
                                <a 
                                    id="download-button" 
                                    href={audioUrl} 
                                    download="voice-over.wav" 
                                    className="mt-4 w-full flex justify-center items-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                >
                                    Download Suara (.wav)
                                </a>
                            </>
                        )}
                        
                        {errorMessage && (
                            <p className="text-sm text-red-600 mt-2 p-3 bg-red-100 border border-red-400 rounded-lg">
                                {errorMessage}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TTSGenerator;