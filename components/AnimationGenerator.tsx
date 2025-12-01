
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Play, 
  User, 
  Copy, 
  Check,
  Video,
  List,
  MapPin,
  Upload,
  ScanFace,
  Image as ImageIcon,
  Anchor,
  Eye,
  Maximize,
  Smartphone,
  Square,
  Download,
  X,
  FileJson,
  Loader2,
  AlertCircle,
  Activity,
  MessageSquare,
  Lock,
  ArrowDown,
  StopCircle,
  RefreshCw,
  Film // Added Film icon
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { fileToBase64, delay } from '../utils'; // Added delay import

// --- ANIMAJINASI SYSTEM PROMPT (THE BLUEPRINT) ---
const ANIMAJINASI_SCHEMA = `
{
  "system": "AnimaJinasi v8.0 - Absolute Consistency",
  "description": "Stateless cinematic storytelling engine...",
  "scene_rules": {
    "format": "Canva Text-to-Video",
    "continuity_bridging": "pre_action -> main_action -> post_action -> micro_transition",
    "mandatory_footer": "Audio: Audio in bahasa"
  },
  "scene_blueprint_template": {
    "scene_id": "S#",
    "duration_sec": 6,
    "visual_style": "3D cartoon cinematic animation, stylized, non-photorealistic, warm afternoon light. Dialogue must be Indonesian inside [ ... ].",
    "character_lock": {
      "CHAR_A": {
        "name": "Exact name",
        "age": "Child|Teen|Adult",
        "visual_dna_enforced": "TRUE",
        "action_flow": {
          "pre_action": "Short setup",
          "main_action": "Primary action",
          "post_action": "Bridge pose",
          "micro_transition": "Idle motion",
          "camera_support_motion": "Camera move"
        }
      }
    },
    "background_lock": {
      "setting": "Specific location name",
      "scenery": "Key visual elements",
      "lighting": "Time of day/mood"
    },
    "camera": {
      "framing": "Shot type",
      "movement": "Pan/track/dolly/zoom"
    },
    "dialogue": [
      {
        "speaker": "CHAR_A",
        "voice_profile": "Gender, Tone, Pace, Emotion (MUST BE CONSISTENT)",
        "language": "id-ID",
        "line": "[Short Indonesian line]"
      }
    ]
  }
}
`;

// 1. ANALYZE IMAGE (VISION)
const analyzeCharacterImage = async (file: File) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToBase64(file);
  
  const prompt = `
    Analyze the character in this image effectively for a 3D Animation Character Sheet.
    Return a JSON object with these keys (translate description to Indonesian mixed with English terms for best prompting):
    {
      "appearance": "Detailed face description (eyes, nose, jawline, distinct features), hair style and color, skin tone. Be very specific to lock consistency.",
      "outfit_top": "Detailed description of top clothing",
      "outfit_bottom": "Detailed description of bottom clothing/pants/shoes"
    }
    RETURN ONLY JSON.
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { text: prompt },
            { inlineData: { mimeType: file.type, data: base64Data } }
        ],
        config: {
            responseMimeType: 'application/json'
        }
    });
    
    const text = response.text;
    if (!text) throw new Error("Gagal menganalisa gambar");
    return JSON.parse(text);
  } catch (error) {
    console.error("Vision Error:", error);
    throw error;
  }
};

// 2. GENERATE STORY (TEXT)
const generateStoryWithGemini = async (character: any, title: string, model: any, mode = 'initial', existingScenes: any[] = []) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let taskInstruction = "";
  let contextData = "";
  let storyContext = "";

  if (existingScenes && existingScenes.length > 0) {
    const recentScenes = existingScenes.slice(-3); 
    storyContext = recentScenes.map((s, idx) => {
      const action = s.character_lock?.CHAR_A?.action_flow?.main_action || "Unknown action";
      const dialogue = s.dialogue?.[0]?.line || "No dialogue";
      return `Scene ${existingScenes.length - recentScenes.length + idx + 1}: Action="${action}" | Dialogue="${dialogue}"`;
    }).join("\n      ");
  }

  const visualAnchor = `
    *** VISUAL DNA ANCHOR (HIGHEST PRIORITY) ***
    - Face/Hair: ${character.appearance}
    - Top Outfit: ${character.outfit_top}
    - Bottom Outfit: ${character.outfit_bottom}
  `;

  if (mode === 'initial') {
    taskInstruction = "Generate 5 INITIAL SCENES to start the story.";
    contextData = `
      - Story Title: "${title}"
      - Main Character Name: "${character.name}"
      ${visualAnchor}
      - Visual Style: ${model.name}
    `;
  } else if (mode === 'next') {
    taskInstruction = "Generate 1 NEW SCENE that advances the plot.";
    contextData = `
      - Story Title: "${title}"
      ${visualAnchor}
      - STORY_SO_FAR (Context):
      ${storyContext}
    `;
  } else if (mode === 'closing') {
    taskInstruction = "Generate 1 FINAL SCENE to END the story.";
    contextData = `
      - Story Title: "${title}"
      ${visualAnchor}
      - STORY_SO_FAR:
      ${storyContext}
    `;
  }

  const prompt = `
    ${ANIMAJINASI_SCHEMA}

    ---
    INPUT CONTEXT:
    ${contextData}

    TASK:
    ${taskInstruction}
    
    CRITICAL REQUIREMENTS:
    1. Output MUST be a valid JSON Array.
    2. Dialogue MUST be Indonesian [ ... ].
    3. Focus on ACTION and PLOT. Do not worry about describing the clothes repeatedly, the system will handle it.
    
    RETURN ONLY JSON.
  `;

  let attempts = 0;
  const maxAttempts = 3;
  const delays = [2000, 4000, 8000];

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash', // Using standardized flash model
          contents: [{ parts: [{ text: prompt }] }],
          config: { responseMimeType: 'application/json' }
      });

      const text = response.text;
      if (!text) throw new Error("No content generated");

      let parsedData = JSON.parse(text);
      if (!Array.isArray(parsedData)) parsedData = [parsedData];

      // ABSOLUTE CONSISTENCY ENFORCER
      const enforcedScenes = parsedData.map((scene: any) => {
        const s = JSON.parse(JSON.stringify(scene));
        if (!s.character_lock) s.character_lock = {};
        if (!s.character_lock.CHAR_A) s.character_lock.CHAR_A = {};
        
        s.character_lock.CHAR_A.name = character.name;
        s.character_lock.CHAR_A.hair = character.appearance; 
        s.character_lock.CHAR_A.outfit_top = character.outfit_top;
        s.character_lock.CHAR_A.outfit_bottom = character.outfit_bottom;

        return s;
      });

      return enforcedScenes;

    } catch (error) {
      attempts++;
      if (attempts === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[attempts - 1]));
    }
  }
};

// 3. GENERATE IMAGE (IMAGEN) - WITH ASPECT RATIO
const generateImageWithImagen = async (prompt: string, aspectRatio = '16:9') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Sanitize prompt: remove newlines, extra spaces, limit length to prevent bad request
  const cleanPrompt = prompt.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

  try {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: cleanPrompt,
        config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio,
            outputMimeType: 'image/jpeg'
        }
    });
    
    if (response.generatedImages && response.generatedImages[0]?.image?.imageBytes) {
         return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
    }
    throw new Error("No image data returned from API");
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};


// --- Components ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'magic' | 'success';
    isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ children, onClick, variant = 'primary', className = '', disabled = false, isLoading = false, title = '' }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed justify-center";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30",
    secondary: "bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-600",
    danger: "bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30",
    ghost: "bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white",
    magic: "bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white shadow-lg shadow-orange-500/30",
    success: "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      title={title}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
};

// --- Main Component ---

const AnimationGenerator: React.FC = () => {
  const [activeTab, setActiveTab] = useState('setup');
  const [storyTitle, setStoryTitle] = useState('');
  
  // Character State
  const [character, setCharacter] = useState({
    name: 'Budi',
    appearance: 'Anak kecil Indonesia, rambut hitam pendek, kulit sawo matang, wajah polos',
    outfit_top: 'Kaos merah polos',
    outfit_bottom: 'Celana pendek biru jeans'
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Aspect Ratio State
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [selectedModel, setSelectedModel] = useState({ id: 'veo', name: '3D Disney Pixar Style' });
  
  // Scenes & UI State
  const [scenes, setScenes] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingNext, setIsAddingNext] = useState(false);
  const [isAddingClosing, setIsAddingClosing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | string | null>(null);
  const scenesEndRef = useRef<HTMLDivElement>(null);
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [loadingVideos, setLoadingVideos] = useState<Record<number, boolean>>({}); // Loading state for videos
  
  // Fullscreen Modal State
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const scrollToBottom = () => {
    scenesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (scenes.length > 0 && activeTab === 'scenes') {
      scrollToBottom();
    }
  }, [scenes, activeTab]);

  // Handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreviewImage(objectUrl);
    
    setIsScanning(true);
    try {
      const result = await analyzeCharacterImage(file);
      setCharacter(prev => ({
        ...prev,
        appearance: result.appearance || prev.appearance,
        outfit_top: result.outfit_top || prev.outfit_top,
        outfit_bottom: result.outfit_bottom || prev.outfit_bottom
      }));
    } catch (err) {
      setErrorMsg("Gagal memindai gambar. Pastikan format gambar benar.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAutoGenerateStory = async () => {
    if (!storyTitle.trim()) {
      setErrorMsg("Mohon isi Judul Cerita.");
      return;
    }
    setErrorMsg('');
    setIsGenerating(true);
    
    try {
      const aiScenes = await generateStoryWithGemini(character, storyTitle, selectedModel, 'initial');
      const processedScenes = aiScenes.map((s: any, i: number) => ({
        ...s,
        id: Date.now() + i,
        generated_image: null,
        video_url: null
      }));
      setScenes(processedScenes);
      setActiveTab('scenes');
    } catch (error) {
      console.error("Error:", error);
      setErrorMsg("Gagal generate. Coba lagi.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddNextScene = async () => {
    setIsAddingNext(true);
    try {
      const aiScenes = await generateStoryWithGemini(character, storyTitle, selectedModel, 'next', scenes);
      if (aiScenes && aiScenes.length > 0) {
        const newScene = { ...aiScenes[0], id: Date.now(), generated_image: null, video_url: null };
        setScenes(prev => [...prev, newScene]);
      }
    } catch (error) {
      setErrorMsg("Gagal menambah scene.");
    } finally {
      setIsAddingNext(false);
    }
  };

  const handleAddClosingScene = async () => {
    setIsAddingClosing(true);
    try {
      const aiScenes = await generateStoryWithGemini(character, storyTitle, selectedModel, 'closing', scenes);
      if (aiScenes && aiScenes.length > 0) {
        const newScene = { ...aiScenes[0], id: Date.now(), generated_image: null, video_url: null };
        setScenes(prev => [...prev, newScene]);
      }
    } catch (error) {
      setErrorMsg("Gagal membuat ending.");
    } finally {
      setIsAddingClosing(false);
    }
  };

  const handleGeneratePreview = async (sceneId: number, scene: any) => {
    setLoadingImages(prev => ({...prev, [sceneId]: true}));
    
    const char = scene.character_lock.CHAR_A;
    const bg = scene.background_lock;
    
    const rawPrompt = `
      ${selectedModel.name}, 
      Character: ${char.hair}, wearing ${char.outfit_top} and ${char.outfit_bottom}.
      Action: ${char.action_flow.main_action}.
      Setting: ${bg.setting}, ${bg.scenery}, ${bg.lighting}.
      Cinematic framing, high quality, 3D render.
    `;

    try {
      const imageUrl = await generateImageWithImagen(rawPrompt, aspectRatio);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generated_image: imageUrl, video_url: null } : s)); // Reset video if image changes
    } catch (error: any) {
      console.error(error);
      alert(`Gagal generate gambar: ${error.message}`);
    } finally {
      setLoadingImages(prev => ({...prev, [sceneId]: false}));
    }
  };

  const handleGenerateVideo = async (sceneId: number, scene: any) => {
    // 1. Validation
    if (!scene.generated_image) {
      alert("Harap generate 'Visual Preview' terlebih dahulu agar karakter konsisten.");
      return;
    }

    if ((window as any).aistudio && !await (window as any).aistudio.hasSelectedApiKey()) {
        await (window as any).aistudio.openSelectKey();
    }

    setLoadingVideos(prev => ({...prev, [sceneId]: true}));

    try {
      // 2. Prepare Prompt
      const char = scene.character_lock.CHAR_A;
      const bg = scene.background_lock;
      
      // Dialog extraction
      const dialogueLine = scene.dialogue?.[0]?.line;
      const voiceProfile = scene.dialogue?.[0]?.voice_profile;

      let prompt = `
        3D Cinematic Animation.
        Character: ${char.hair}, wearing ${char.outfit_top} and ${char.outfit_bottom}.
        Action: ${char.action_flow.main_action}.
        Setting: ${bg.setting}, ${bg.scenery}, ${bg.lighting}.
        Style: ${selectedModel.name}, High quality, 4k resolution.
      `;

      // INJECT DIALOGUE INSTRUCTION
      if (dialogueLine) {
        prompt += `\n\nCRITICAL INSTRUCTION: The character is speaking this line: "${dialogueLine}". Expression/Tone: ${voiceProfile || 'Normal'}. Ensure lip movement matches speech.`;
      }

      // 3. Call Veo
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imageBytes = scene.generated_image.split(',')[1];
      
      // Determine Ratio for Veo (Veo only supports limited ratios in preview, mostly landscape/portrait)
      const veoRatio = aspectRatio === '9:16' ? '9:16' : '16:9'; 

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
            imageBytes: imageBytes,
            mimeType: 'image/jpeg'
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: veoRatio
        }
      });

      // 4. Polling
      while (!operation.done) {
        await delay(5000);
        operation = await ai.operations.getVideosOperation({operation});
      }

      if (operation.error) {
        throw new Error(operation.error.message);
      }

      // 5. Retrieve Video
      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) throw new Error("Video URI not found");

      const vidResp = await fetch(`${uri}&key=${process.env.API_KEY}`);
      if (!vidResp.ok) throw new Error("Failed to download video");
      const blob = await vidResp.blob();
      const videoUrl = URL.createObjectURL(blob);

      // 6. Update State
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, video_url: videoUrl } : s));

    } catch (err: any) {
      console.error("Video Gen Error:", err);
      let msg = err.message || "Gagal membuat video.";
      
      // Robust error checking for quota limits
      if (
        JSON.stringify(err).includes("RESOURCE_EXHAUSTED") || 
        JSON.stringify(err).includes("429") || 
        msg.includes("429") || 
        msg.includes("RESOURCE_EXHAUSTED")
      ) {
         msg = "Kuota API Habis (429 Resource Exhausted). Harap periksa Billing/Kuota API Key Anda atau tunggu beberapa saat.";
      }
      alert(msg);
    } finally {
      setLoadingVideos(prev => ({...prev, [sceneId]: false}));
    }
  };

  const updateDeepState = (sceneId: number, path: string, value: any) => {
    setScenes(prev => prev.map(scene => {
      if (scene.id !== sceneId) return scene;
      
      const newScene = JSON.parse(JSON.stringify(scene)); // Deep clone
      let current = newScene;
      const keys = path.split('.');
      const lastKey = keys.pop();
      
      for (const key of keys) {
        if (!current[key]) current[key] = {};
        current = current[key];
      }
      if (lastKey) current[lastKey] = value;
      return newScene;
    }));
  };

  const copyToClipboardText = (text: string, index: string | number) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadImageLocal = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAspectRatioClass = (ratio: string) => {
    switch (ratio) {
      case '16:9': return 'aspect-video';
      case '9:16': return 'aspect-[9/16]'; 
      case '1:1': return 'aspect-square';
      case '4:3': return 'aspect-[4/3]';
      case '3:4': return 'aspect-[3/4]';
      default: return 'aspect-video';
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-200 font-sans selection:bg-yellow-500/30 rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
      
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f1117]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-600 to-orange-700 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
              <FileJson className="w-6 h-6 text-white" />
            </div>
            <div>
                 <span className="text-xl font-bold text-white block leading-none">RAHYANG ANIMASI</span>
                 <span className="text-[10px] text-gray-500 font-mono tracking-widest">V8.0 ENGINE</span>
            </div>
          </div>
          
          <nav className="flex gap-1 bg-gray-900/80 p-1.5 rounded-xl border border-gray-800/50">
            <Button variant="ghost" onClick={() => setActiveTab('setup')} className={activeTab === 'setup' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400'}>Setup</Button>
            <Button variant="ghost" onClick={() => setActiveTab('scenes')} className={activeTab === 'scenes' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400'}>Storyboard</Button>
            <Button variant="ghost" onClick={() => setActiveTab('json')} className={activeTab === 'json' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400'}>JSON</Button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5" /> {errorMsg}
          </div>
        )}

        {/* SETUP TAB */}
        {activeTab === 'setup' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Blueprint Generator</h1>
              <p className="text-gray-400 text-lg">Setup karakter di sini akan dikunci mati <span className="text-yellow-500 font-bold">(Hard Lock)</span> untuk konsistensi di semua scene.</p>
            </div>

            <div className="bg-[#161922] border border-gray-800 p-8 rounded-3xl space-y-8 shadow-xl">
              
              {/* IMAGE UPLOADER */}
              <div className="p-6 bg-black/40 rounded-2xl border border-dashed border-gray-700 hover:border-blue-500/50 transition-colors flex flex-col md:flex-row gap-8 items-center">
                 <div className="relative group w-40 h-40 flex-shrink-0 bg-gray-800 rounded-2xl overflow-hidden flex items-center justify-center border border-gray-700 shadow-inner">
                    {previewImage ? (
                      <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-16 h-16 text-gray-600" />
                    )}
                    {isScanning && (
                       <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                         <ScanFace className="w-10 h-10 text-yellow-500 animate-pulse" />
                       </div>
                    )}
                 </div>
                 
                 <div className="flex-1 space-y-4 text-center md:text-left">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2 mb-1">
                        <ImageIcon className="w-5 h-5 text-blue-400" /> Upload Referensi Karakter
                        </h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                        Upload foto untuk "Scan DNA". <span className="text-yellow-500 font-bold">Hasil scan ini akan DI-HARDCODE ke setiap scene</span>, jadi AI tidak mungkin mengubah konsistensi karakter Anda.
                        </p>
                    </div>
                    <div className="flex gap-4 justify-center md:justify-start">
                       <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 active:scale-95">
                          <Upload className="w-4 h-4" /> Pilih Foto
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                       </label>
                       {isScanning && <span className="text-yellow-500 text-sm font-medium animate-pulse flex items-center bg-yellow-500/10 px-4 rounded-xl">Scanning DNA...</span>}
                    </div>
                 </div>
              </div>

              <div className="border-t border-gray-800"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-400 mb-2">Judul Cerita</label>
                    <input 
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-5 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
                    placeholder="Judul cerita..."
                    />
                </div>

                {/* ASPECT RATIO SELECTOR */}
                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-400 mb-3">Rasio Gambar Output</label>
                    <div className="grid grid-cols-3 gap-4">
                    {[
                        { value: '16:9', label: 'Landscape', sub: 'Youtube', icon: Maximize },
                        { value: '9:16', label: 'Portrait', sub: 'Tiktok/Reels', icon: Smartphone },
                        { value: '1:1', label: 'Square', sub: 'Feed', icon: Square }
                    ].map((option) => (
                        <button
                        key={option.value}
                        onClick={() => setAspectRatio(option.value)}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 ${
                            aspectRatio === option.value 
                            ? 'bg-blue-600/10 border-blue-500 text-white ring-1 ring-blue-500/50' 
                            : 'bg-black/30 border-gray-800 text-gray-500 hover:bg-gray-800 hover:border-gray-600'
                        }`}
                        >
                        <option.icon className={`w-7 h-7 mb-2 ${aspectRatio === option.value ? 'text-blue-400' : 'text-gray-600'}`} />
                        <span className="text-sm font-bold">{option.label}</span>
                        <span className="text-[10px] uppercase tracking-wider opacity-60 mt-1">{option.sub}</span>
                        </button>
                    ))}
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-semibold text-gray-400 mb-2">Nama Karakter</label>
                   <input 
                    value={character.name}
                    onChange={(e) => setCharacter({...character, name: e.target.value})}
                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-5 py-3 text-white focus:border-yellow-500 outline-none"
                  />
                </div>
                
                <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2">
                     <Anchor className="w-4 h-4" /> Visual DNA (Face & Hair) - LOCKED
                   </label>
                   <textarea 
                    value={character.appearance}
                    onChange={(e) => setCharacter({...character, appearance: e.target.value})}
                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-5 py-3 text-white focus:border-yellow-500 outline-none h-28 text-sm leading-relaxed"
                    placeholder="Deskripsi ini akan ditimpa paksa ke setiap scene..."
                  />
                </div>
                
                <div>
                   <label className="block text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2">
                     <Anchor className="w-4 h-4" /> Pakaian Atas - LOCKED
                   </label>
                   <input 
                    value={character.outfit_top}
                    onChange={(e) => setCharacter({...character, outfit_top: e.target.value})}
                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-5 py-3 text-white focus:border-yellow-500 outline-none text-sm"
                  />
                </div>
                <div>
                   <label className="block text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2">
                     <Anchor className="w-4 h-4" /> Pakaian Bawah - LOCKED
                   </label>
                   <input 
                    value={character.outfit_bottom}
                    onChange={(e) => setCharacter({...character, outfit_bottom: e.target.value})}
                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-5 py-3 text-white focus:border-yellow-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="pt-4">
                  <Button variant="magic" onClick={handleAutoGenerateStory} isLoading={isGenerating} className="w-full py-4 text-lg font-bold rounded-2xl shadow-orange-900/40">
                    {isGenerating ? 'Sedang Menyusun Blueprint (Locked Mode)...' : 'Generate Initial Blueprint'}
                  </Button>
              </div>
            </div>
          </div>
        )}

        {/* SCENES TAB (Complex Editor) */}
        {activeTab === 'scenes' && (
          <div className="space-y-8 pb-20">
             {scenes.length === 0 ? (
               <div className="text-center py-32 text-gray-500 flex flex-col items-center">
                   <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                       <FileJson className="w-10 h-10 opacity-30"/>
                   </div>
                   <p className="text-xl font-medium">Belum ada blueprint.</p>
                   <p className="text-sm">Silakan generate di tab Setup terlebih dahulu.</p>
               </div>
             ) : (
               <>
                {scenes.map((scene, idx) => {
                  const charLock = scene.character_lock?.CHAR_A || {};
                  const actionFlow = charLock.action_flow || {};
                  const dialogue = scene.dialogue?.[0] || {};
                  const bgLock = scene.background_lock || {};

                  return (
                    <div key={scene.id} className="bg-[#161922] border border-gray-800 rounded-3xl p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden shadow-lg">
                      {/* Decorative Label */}
                      <div className="absolute top-0 right-0 bg-yellow-600/10 border-l border-b border-yellow-600/20 px-4 py-2 text-xs text-yellow-500 font-bold font-mono rounded-bl-2xl">
                         SCENE {idx + 1}
                      </div>

                      <div className="flex flex-col xl:flex-row gap-8">
                        
                        {/* LEFT COLUMN: VISUAL PREVIEW & VIDEO */}
                        <div className="w-full xl:w-[400px] flex-shrink-0 space-y-4">
                           {/* DYNAMIC ASPECT RATIO CONTAINER */}
                           <div className={`${getAspectRatioClass(aspectRatio)} bg-black rounded-2xl border border-gray-800 overflow-hidden relative group transition-all duration-300 mx-auto shadow-2xl`}>
                             {scene.generated_image ? (
                               <>
                                <img src={scene.generated_image} alt="Scene Preview" className="w-full h-full object-cover" />
                                
                                {/* OVERLAY WITH ACTION BUTTONS */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4 backdrop-blur-[2px]">
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); setFullScreenImage(scene.generated_image); }}
                                      className="p-3 bg-white/10 hover:bg-blue-600 rounded-full text-white transition-all transform hover:scale-110 shadow-lg border border-white/20"
                                      title="Lihat Fullscreen"
                                    >
                                      <Eye className="w-6 h-6" />
                                    </button>
                                    <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        downloadImageLocal(scene.generated_image, `Scene-${idx+1}_${storyTitle.replace(/\s+/g, '-')}.png`); 
                                      }}
                                      className="p-3 bg-white/10 hover:bg-green-600 rounded-full text-white transition-all transform hover:scale-110 shadow-lg border border-white/20"
                                      title="Download Gambar"
                                    >
                                      <Download className="w-6 h-6" />
                                    </button>
                                </div>
                               </>
                             ) : (
                               <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 gap-3 p-4 text-center">
                                  <Video className="w-12 h-12 opacity-20" />
                                  <span className="text-sm font-medium opacity-50">Visual belum di-render<br/>({aspectRatio})</span>
                               </div>
                             )}
                             
                             {loadingImages[scene.id] && (
                               <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col gap-3 z-10 backdrop-blur-sm">
                                 <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
                                 <span className="text-xs font-bold text-yellow-500 tracking-wider">RENDERING VISUAL...</span>
                               </div>
                             )}
                           </div>
                           
                           <Button 
                              variant={scene.generated_image ? "secondary" : "magic"} 
                              onClick={() => handleGeneratePreview(scene.id, scene)}
                              isLoading={loadingImages[scene.id]}
                              className="w-full py-3 text-sm font-bold shadow-md"
                           >
                              {scene.generated_image ? <RefreshCw className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              {scene.generated_image ? "Regenerate Visual" : "Generate Visual Preview"}
                           </Button>

                           {/* --- VIDEO VEO SECTION --- */}
                           {scene.generated_image && (
                              <div className="pt-4 border-t border-gray-800 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-2 mb-2">
                                  <Film className="w-3 h-3" /> Veo 3 Video (Consistent)
                                </label>
                                
                                {scene.video_url ? (
                                    <div className="space-y-2">
                                        <div className="rounded-xl overflow-hidden border border-gray-700 bg-black">
                                            <video src={scene.video_url} controls className="w-full h-auto" />
                                        </div>
                                        <a 
                                            href={scene.video_url} 
                                            download={`Scene-${idx+1}_video.mp4`}
                                            className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-bold transition"
                                        >
                                            <Download className="w-3 h-3 inline mr-1" /> Download Video
                                        </a>
                                    </div>
                                ) : (
                                    <Button 
                                        variant="danger" 
                                        onClick={() => handleGenerateVideo(scene.id, scene)}
                                        isLoading={loadingVideos[scene.id]}
                                        className="w-full py-3 text-sm font-bold shadow-md shadow-red-900/20"
                                    >
                                        <Film className="w-4 h-4" /> Generate Video (Veo)
                                    </Button>
                                )}
                              </div>
                           )}
                        </div>

                        {/* RIGHT COLUMN: EDITOR */}
                        <div className="flex-1 space-y-6">
                            {/* ROW 1: Character Lock & Environment Lock */}
                            <div className="grid md:grid-cols-2 gap-6">
                              <div className="space-y-2 bg-blue-900/10 p-4 rounded-2xl border border-blue-900/30">
                                <label className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2 mb-2">
                                  <Lock className="w-3 h-3" /> Character (Locked)
                                </label>
                                <div className="space-y-2">
                                  <input 
                                    value={charLock.outfit_top || ''}
                                    readOnly
                                    className="w-full bg-black/40 border border-blue-900/30 rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed"
                                  />
                                  <input 
                                    value={charLock.outfit_bottom || ''}
                                    readOnly
                                    className="w-full bg-black/40 border border-blue-900/30 rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed"
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-2 bg-green-900/10 p-4 rounded-2xl border border-green-900/30">
                                <label className="text-[10px] font-bold text-green-400 uppercase flex items-center gap-2 mb-2">
                                  <MapPin className="w-3 h-3" /> Environment
                                </label>
                                <div className="space-y-2">
                                  <input 
                                    value={bgLock.setting || ''}
                                    onChange={(e) => updateDeepState(scene.id, 'background_lock.setting', e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:border-green-500 outline-none"
                                    placeholder="Location Name"
                                  />
                                  <input 
                                    value={bgLock.lighting || ''}
                                    onChange={(e) => updateDeepState(scene.id, 'background_lock.lighting', e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:border-green-500 outline-none"
                                    placeholder="Lighting/Mood"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* ROW 2: ACTION FLOW */}
                            <div className="bg-black/20 rounded-2xl p-4 border border-gray-800">
                              <label className="text-[10px] font-bold text-yellow-500 uppercase mb-3 flex items-center gap-2">
                                <Activity className="w-3 h-3" /> Action Flow
                              </label>
                              <div className="space-y-3">
                                <input 
                                  value={actionFlow.main_action || ''}
                                  onChange={(e) => updateDeepState(scene.id, 'character_lock.CHAR_A.action_flow.main_action', e.target.value)}
                                  className="w-full bg-gray-900 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm text-white focus:border-yellow-500 outline-none"
                                  placeholder="Main Action..."
                                />
                                <div className="flex gap-3">
                                  <input 
                                    value={actionFlow.pre_action || ''}
                                    onChange={(e) => updateDeepState(scene.id, 'character_lock.CHAR_A.action_flow.pre_action', e.target.value)}
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-400 focus:border-yellow-500 outline-none"
                                    placeholder="Pre-action"
                                  />
                                  <input 
                                    value={actionFlow.post_action || ''}
                                    onChange={(e) => updateDeepState(scene.id, 'character_lock.CHAR_A.action_flow.post_action', e.target.value)}
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-400 focus:border-yellow-500 outline-none"
                                    placeholder="Post-action"
                                  />
                                </div>
                              </div>
                            </div>

                             {/* ROW 3: DIALOGUE */}
                             <div className="bg-purple-900/10 p-4 rounded-2xl border border-purple-900/30">
                                <label className="text-[10px] font-bold text-purple-400 uppercase flex items-center gap-2 mb-3">
                                  <MessageSquare className="w-3 h-3" /> Dialogue
                                </label>
                                <div className="flex gap-3">
                                   <div className="w-1/3 md:w-1/4">
                                     <input 
                                        value={dialogue.voice_profile || ''}
                                        onChange={(e) => {
                                          const newDialogue = [...(scene.dialogue || [])];
                                          if(!newDialogue[0]) newDialogue[0] = {};
                                          newDialogue[0].voice_profile = e.target.value;
                                          updateDeepState(scene.id, 'dialogue', newDialogue);
                                        }}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-xs text-purple-300 placeholder-gray-600 focus:border-purple-500 outline-none"
                                        placeholder="Tone/Emotion"
                                      />
                                   </div>
                                   <div className="flex-1">
                                     <input 
                                        value={dialogue.line || ''}
                                        onChange={(e) => {
                                          const newDialogue = [...(scene.dialogue || [])];
                                          if(!newDialogue[0]) newDialogue[0] = {};
                                          newDialogue[0].line = e.target.value;
                                          updateDeepState(scene.id, 'dialogue', newDialogue);
                                        }}
                                        className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2.5 text-sm text-purple-200 italic focus:border-purple-500 outline-none"
                                        placeholder="[Indonesian Dialogue]"
                                      />
                                   </div>
                                </div>
                             </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
                
                {/* INFINITE GENERATION CONTROLS */}
                <div ref={scenesEndRef} className="flex flex-col md:flex-row gap-4 border-t border-gray-800 pt-8 mt-10">
                  <div className="flex-1 flex gap-3">
                    <Button 
                      variant="secondary" 
                      onClick={handleAddNextScene} 
                      isLoading={isAddingNext}
                      className="flex-1 py-3"
                    >
                      <Plus className="w-5 h-5" /> Next Scene
                    </Button>
                    <Button 
                      variant="danger" 
                      onClick={handleAddClosingScene} 
                      isLoading={isAddingClosing}
                      className="flex-1 py-3"
                    >
                      <StopCircle className="w-5 h-5" /> End Story
                    </Button>
                  </div>
                  <Button 
                    variant="primary" 
                    onClick={() => setActiveTab('json')}
                    className="md:w-1/3 py-3 font-bold"
                  >
                    Finalize JSON <ArrowDown className="w-5 h-5" />
                  </Button>
                </div>
               </>
             )}
          </div>
        )}

        {/* JSON OUTPUT TAB */}
        {activeTab === 'json' && (
          <div className="space-y-8 animate-in fade-in pb-20 max-w-4xl mx-auto">
             {/* Global Copy */}
             <div className="bg-[#161922] border border-gray-800 rounded-2xl p-6 shadow-lg">
               <div className="flex justify-between items-center mb-4">
                 <div>
                    <h3 className="text-white font-bold flex items-center gap-2 text-lg">
                    <List className="w-5 h-5 text-yellow-500" /> All Scenes (Complete Array)
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Gunakan ini jika sistem video Anda menerima Array JSON sekaligus.</p>
                 </div>
                 <Button 
                   variant="secondary" 
                   onClick={() => copyToClipboardText(JSON.stringify(scenes, null, 2), 'all')}
                   className="text-sm"
                 >
                   {copiedIndex === 'all' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                   {copiedIndex === 'all' ? 'Copied!' : 'Copy All'}
                 </Button>
               </div>
               
             </div>

             {/* Individual Scenes */}
             <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-2">Individual Scene Blocks</h3>
                {scenes.map((scene, idx) => (
                  <div key={scene.id} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden transition-all hover:border-gray-700">
                    <div className="flex justify-between items-center bg-gray-800/50 px-5 py-3 border-b border-gray-800">
                      <h4 className="text-sm font-bold text-white flex items-center gap-3">
                        <span className="bg-yellow-600 text-black text-xs px-2 py-0.5 rounded font-bold font-mono">S{idx+1}</span>
                        Scene {idx + 1}
                      </h4>
                      <Button 
                        variant="ghost" 
                        onClick={() => copyToClipboardText(JSON.stringify(scene, null, 2), `scene-${idx}`)}
                        className="text-xs h-8 hover:bg-gray-700"
                      >
                        {copiedIndex === `scene-${idx}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        {copiedIndex === `scene-${idx}` ? 'Copied' : 'Copy JSON'}
                      </Button>
                    </div>
                    <pre className="text-xs text-gray-400 font-mono overflow-x-auto p-5 bg-[#0a0a0a] custom-scrollbar max-h-[300px]">
                      {JSON.stringify(scene, null, 2)}
                    </pre>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      {/* FULL SCREEN MODAL */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFullScreenImage(null)}
        >
          <button 
            onClick={() => setFullScreenImage(null)}
            className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors p-3 bg-white/10 rounded-full hover:bg-white/20"
          >
            <X className="w-8 h-8" />
          </button>
          
          <img 
            src={fullScreenImage} 
            alt="Fullscreen Preview" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

    </div>
  );
}

export default AnimationGenerator;
