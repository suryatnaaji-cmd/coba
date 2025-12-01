import React, { useState, useRef, useEffect } from 'react';
import { Camera, Download, Sparkles, Image as ImageIcon, Upload, Loader2, Wand2, X, Edit3, Layers, ChefHat, Zap, Crop, Eye, RefreshCw, Video, Copy, Scan } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { fileToBase64, compressImage, cropImageToRatio, copyToClipboard, downloadImage, delay } from '../utils';

const FoodDrinkGenerator: React.FC = () => {
    // State
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    
    // New Data Structure: { 'Category Name': [img1, img2, img3, img4] }
    const [results, setResults] = useState<Record<string, (string | null)[]>>({});
    const [videoPromptData, setVideoPromptData] = useState<Record<string, { visual: string; script: string } | null>>({}); 
    const [foodContext, setFoodContext] = useState<any | null>(null); // Stores analyzed flavor/keywords
    
    const [loading, setLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState('');
    const [error, setError] = useState('');
    const [productName, setProductName] = useState('');
    
    // Editing State
    const [aspectRatio, setAspectRatio] = useState('Original'); // State for Ratio

    // Feature States
    const [previewImage, setPreviewImage] = useState<string | null>(null); // For Modal View
    const [regenerating, setRegenerating] = useState<{ category: string; index: number } | null>(null);
    const [generatingText, setGeneratingText] = useState<string | null>(null); // { category-index } for text prompt

    // Ratios
    const ratios = [
        { label: 'Asli', value: 'Original' },
        { label: '1:1 (Square)', value: '1:1' },
        { label: '4:5 (Portrait)', value: '4:5' },
        { label: '16:9 (Landscape)', value: '16:9' },
        { label: '9:16 (Story)', value: '9:16' }
    ];

    // 5 CORE STYLES + Custom
    const styles = [
        { 
            name: 'Poster Promo', 
            desc: 'Desain poster lengkap dengan teks judul menarik.', 
            prompt: 'Professional food poster design for [FOOD], including BOLD TYPOGRAPHY TEXT overlay directly on image (e.g., [KEYWORDS]). Modern graphic design layout, magazine quality, appetite-appeal lighting, sharp details. WAJIB ADA TEKS JUDUL YANG ESTETIK PADA GAMBAR.' 
        },
        { 
            name: 'Cinematic Commercial', 
            desc: 'Seperti iklan TV 8K, hero shot, mewah.', 
            prompt: 'Cinematic 8K hyper-realistic commercial food advertisement, dramatic soft lighting, ultra-detailed textures, [FOOD] placed as the hero, premium studio setup, crisp close-up, shallow depth of field, luxury color grading, perfect highlights, droplets and textures highly visible, professional advertising style, clean background, high-end product photography. NO TEXT overlays.' 
        },
        { 
            name: 'Di Tempat Makan', 
            desc: 'Suasana restoran, natural, di atas meja.', 
            prompt: 'Cinematic 8K hyper-realistic [FOOD] served on a restaurant table, glossy texture, rising steam, dramatic soft lighting, shallow depth of field, warm ambient restaurant background, natural reflections, ultra-detailed food textures. NO TEXT overlays.' 
        },
        { 
            name: 'Iklan Ekstrim', 
            desc: 'Sensasi rasa ekstrim dengan teks seru.', 
            prompt: 'Cinematic 8K hyper-realistic extreme food advertisement for [FOOD]. INCLUDE EXCITING TEXT OVERLAYS like [KEYWORDS] or the food name. Glossy textures, flying ingredients, dynamic motion, dramatic lighting, high contrast. WAJIB ADA TEKS/TULISAN SERU PADA GAMBAR SESUAI RASA MAKANAN.' 
        },
        { 
            name: 'Dengan Model', 
            desc: 'Model menikmati makanan, candid, warm.', 
            prompt: 'Cinematic 8K hyper-realistic scene of a model eating [FOOD] at a restaurant, glossy texture, steam rising, the model interacting with [FOOD], natural warm restaurant lighting, soft background bokeh, expressive enjoyment, ultra-detailed textures. NO TEXT overlays.' 
        },
        { 
            name: 'Custom Concept', 
            desc: 'Tulis konsep visual Anda sendiri.', 
            prompt: 'CUSTOM' 
        }
    ];

    // --- Handlers ---

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const base64 = await fileToBase64(file);
            const compressed = await compressImage(`data:image/jpeg;base64,${base64}`); 
            setOriginalImage(compressed);
            setResults({}); // Reset results
            setVideoPromptData({});
            setFoodContext(null); // Reset context
            setError('');
        } catch (err) {
            setError('Gagal memproses gambar.');
            console.error(err);
        }
    };

    const callGeminiImageAPI = async (prompt: string, base64Data: string, retries = 3): Promise<string> => {
        // Initialize GoogleGenAI here to ensure it uses the latest API_KEY
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash-image",
                    contents: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                    ],
                });

                if (response.candidates?.[0]?.finishReason === 'SAFETY') throw new Error(`Safety Block: Content may violate safety guidelines.`);
                const imgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (!imgPart || !imgPart.inlineData || !imgPart.inlineData.data) {
                    if (attempt < retries - 1) { await delay(1500); continue; }
                    throw new Error(`No image data returned from API.`);
                }
                return `data:image/jpeg;base64,${imgPart.inlineData.data}`;

            } catch (e: any) {
                console.error(`Attempt ${attempt + 1} failed:`, e);
                if (attempt === retries - 1) throw e;
                await delay(2000 * (attempt + 1)); // Exponential backoff
            }
        }
        throw new Error("Max retries reached for image generation.");
    };

    const callGeminiTextAPI = async (prompt: string, base64Data: string | null = null, retries = 3): Promise<string> => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const contents: any[] = [{ text: prompt }];
        if (base64Data) {
            contents.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash", // Using a text-optimized model
                    contents: contents,
                    config: {
                        responseMimeType: "application/json"
                    }
                });

                if (response.candidates?.[0]?.finishReason === 'SAFETY') throw new Error(`Safety Block: Content may violate safety guidelines.`);
                const text = response.text;
                if (!text) {
                    if (attempt < retries - 1) { await delay(1500); continue; }
                    throw new Error(`No text data returned from API.`);
                }
                return text;

            } catch (e: any) {
                console.error(`Attempt ${attempt + 1} failed:`, e);
                if (attempt === retries - 1) throw e;
                await delay(2000 * (attempt + 1)); // Exponential backoff
            }
        }
        throw new Error("Max retries reached for text generation.");
    };

            // --- NEW: ANALYZE IMAGE CONTEXT ---
            const analyzeFoodContext = async (base64Data: string) => {
                try {
                    const prompt = `Analyze this food image extremely carefully for a commercial poster design.
                    Determine the following:
                    1. "category": Choose one best fit: 
                       - "NoodleBowl" (for noodles, ramen, bakso, rice bowls, messy savory food)
                       - "Drink" (for bottles, glasses, beverages, ice)
                       - "SolidBar" (for chocolate bars, energetic bars, cake slices, long solid items)
                       - "SmallTreat" (for candies, cookies, small chocolate bites, nuggets)
                       - "General" (if none match)
                    2. "flavor": "Spicy", "Sweet", "Savory", "Fresh".
                    3. "creative_title": A short, punchy, 2-3 word poster headline suitable for this food (e.g. "PEDAS NERAKA", "CHOCO BLAST", "FRESH ATTACK"). Uppercase.
                    4. "keywords": 3 visual adjectives for the background/effects.
                    
                    Return ONLY JSON. Example: { "category": "NoodleBowl", "flavor": "Spicy", "creative_title": "PEDAS GILA", "keywords": "FIRE, SMOKE, CHAOS" }`;

                    const resultText = await callGeminiTextAPI(prompt, base64Data.split(',')[1]); // Send image data without "data:image/jpeg;base64," prefix
                    // Clean potential markdown formatting
                    const cleanJson = resultText.replace(/```json|```/g, '').trim();
                    const result = JSON.parse(cleanJson);
                    return result;
                } catch (e) {
                    console.error("Analysis failed, using defaults", e);
                    return { category: "General", flavor: "General", creative_title: "DELICIOUS TASTE", keywords: "DELICIOUS, TASTY, YUMMY" };
                }
            };

            // --- REGENERATE SINGLE IMAGE ---
            const regenerateSingleImage = async (category: string, index: number) => {
                if (regenerating) return; 

                setRegenerating({ category, index });
                
                try {
                    const styleObj = styles.find(s => s.name === category);
                    if (!styleObj) throw new Error("Style not found.");

                    // Use existing context or default
                    const currentContext = foodContext || { keywords: "DELICIOUS, TASTY" };
                    const finalPrompt = getPrompt(styleObj, currentContext);
                    const variationPrompt = `${finalPrompt} --v ${Date.now()}`;
                    
                    if (!originalImage) throw new Error("Original image not available for regeneration.");
                    const croppedBase64 = await cropImageToRatio(originalImage, aspectRatio);
                    const base64Data = croppedBase64.split(',')[1];

                    const newImg = await callGeminiImageAPI(variationPrompt, base64Data);

                    setResults(prev => {
                        const newCategoryImages = [...(prev[category] || [])];
                        newCategoryImages[index] = newImg;
                        return { ...prev, [category]: newCategoryImages };
                    });
                    
                    setVideoPromptData(prev => {
                        const newState = { ...prev };
                        delete newState[`${category}-${index}`];
                        return newState;
                    });

                } catch (err: any) {
                    console.error("Regenerate failed:", err);
                    setError(`Regenerate failed: ${err.message}`);
                } finally {
                    setRegenerating(null);
                }
            };
            
            // --- GENERATE VIDEO PROMPT & SCRIPT ---
            const generateVideoContext = async (category: string, index: number) => {
                const key = `${category}-${index}`;
                setGeneratingText(key);

                try {
                    const isModel = category === 'Dengan Model';
                    const flavor = foodContext ? foodContext.flavor : "Delicious";
                    
                    let systemPrompt = `You are an expert AI Video Prompt Engineer.
                    Create a JSON object with "visual" and "script".
                    Context: A ${category} photo of ${productName} (${flavor}).
                    
                    1. "visual": Hyper-realistic 8K video prompt. ${isModel ? 'Model eating, facial expressions.' : 'Slow motion macro shot, texture details.'}
                    2. "script": ${isModel ? 'Dialog between Model and Friend (Indonesian).' : 'Voiceover script (Indonesian).'}
                    Return raw JSON.`;

                    const textResult = await callGeminiTextAPI(systemPrompt); // No image needed for this text-only prompt
                    const parsed = JSON.parse(textResult);

                    setVideoPromptData(prev => ({ ...prev, [key]: parsed }));

                } catch (err: any) {
                    console.error("Text Gen Error", err);
                    setError(`Video script generation failed: ${err.message}`);
                } finally {
                    setGeneratingText(null);
                }
            };
            
            const renderSafeText = (data: any) => {
                if (typeof data === 'string') return data;
                if (typeof data === 'object' && data !== null) {
                    if (data.dialogue) return data.dialogue;
                    if (data.voiceover) return data.voiceover;
                    if (data.script) return data.script;
                    return JSON.stringify(data);
                }
                return '';
            };

            // --- ULTIMATE PACK GENERATION ---
            const generateUltimatePack = async () => {
                if (!validateInput()) return;

                setLoading(true);
                setError('');
                setResults({}); 
                setVideoPromptData({});
                setFoodContext(null);

                const targetStyles = styles.filter(s => s.name !== 'Custom Concept');

                try {
                    if (!originalImage) {
                         setError('Original image is missing.');
                         return;
                    }

                    const croppedBase64 = await cropImageToRatio(originalImage, aspectRatio);
                    const base64Data = croppedBase64.split(',')[1];

                    // STEP 1: ANALYZE IMAGE FIRST
                    setLoadingStatus("Menganalisa jenis & rasa makanan...");
                    const context = await analyzeFoodContext(croppedBase64); // Pass cropped for analysis
                    setFoodContext(context); // Store for later use
                    console.log("Food Context:", context);

                    // STEP 2: GENERATE IMAGES
                    for (let sIndex = 0; sIndex < targetStyles.length; sIndex++) {
                        const styleObj = targetStyles[sIndex];
                        const styleName = styleObj.name;
                        
                        // Pass context to getPrompt
                        const finalPrompt = getPrompt(styleObj, context);
                        const categoryImages = [];

                        for (let i = 0; i < 4; i++) {
                            setLoadingStatus(`[${sIndex + 1}/5] Kategori: ${styleName} (${i + 1}/4)...`);
                            const variationPrompt = `${finalPrompt} --v ${i}`; 
                            
                            try {
                                const img = await callGeminiImageAPI(variationPrompt, base64Data);
                                categoryImages.push(img);
                                
                                setResults(prev => ({ ...prev, [styleName]: categoryImages }));
                            } catch (e) {
                                console.error(`Failed for ${styleName} #${i}`, e);
                                // Push null to maintain array length for this slot
                                categoryImages.push(null);
                                setResults(prev => ({ ...prev, [styleName]: categoryImages }));
                            }
                            await delay(500); // Small delay between image generations
                        }
                    }
                } catch (err: any) {
                    setError("Terjadi kesalahan koneksi saat generate massal: " + err.message);
                    console.error("Ultimate Pack Generation Error:", err);
                } finally {
                    setLoading(false);
                    setLoadingStatus('');
                }
            };

            const validateInput = () => {
                if (!originalImage) {
                    setError('Silakan upload foto makanan terlebih dahulu.');
                    return false;
                }
                if (!productName.trim()) {
                    setError('Harap isi nama/jenis makanan.');
                    return false;
                }
                return true;
            };

            const getPrompt = (styleObj: { name: string; prompt: string; }, context: any) => {
                const basePrompt = styleObj.prompt;
                const isTextRequired = styleObj.name === 'Poster Promo' || styleObj.name === 'Iklan Ekstrim';
                
                // Default context values if analysis fails
                const keywords = context ? context.keywords : "DELICIOUS, TASTY";
                const flavor = context ? context.flavor : "Delicious";
                const category = context ? context.category : "General";
                const creativeTitle = context ? context.creative_title : productName.toUpperCase();

                // --- SPECIAL LOGIC FOR POSTER PROMO (DYNAMIC TEMPLATES) ---
                if (styleObj.name === 'Poster Promo') {
                    let specificTemplate = "";

                    // 1. Fantasy Storm (For Noodles/Spicy/Savory)
                    if (category === 'NoodleBowl' || (category === 'General' && flavor === 'Spicy')) {
                        specificTemplate = `
                        TYPE: Food Poster - Fantasy Storm.
                        VISUAL TONE: Chaotic, Fiery, Hyper-dynamic, Appetizingly Dangerous.
                        LAYOUT: Deep dark smoky atmosphere with volcanic orange glow from below. Central vortex composition; a massive tornado of [FOOD] spiraling upwards.
                        MAIN IMAGE: A swirling tornado structure made of [FOOD] intertwining with streams of fire/sauce.
                        EFFECTS: Ingredients caught in the wind vortex, explosive powder bursts, hot shimmering oil droplets scattering like sparks, flying glowing embers, thick spicy dark smoke.
                        LIGHTING: Dramatic under-lighting (lava glow) casting deep shadows + sharp orange rim light.
                        COLORS: Primary #FF3300, Secondary #FF8C00, Dark #0F0F0F.
                        `;
                    } 
                    // 2. Refreshment Explosion (For Drinks/Fresh)
                    else if (category === 'Drink' || flavor === 'Fresh') {
                        specificTemplate = `
                        TYPE: Beverage Poster - Refreshment Explosion.
                        VISUAL TONE: Warm Golden/Cool Blue (depending on food), Hyper-Refreshing, Explosive, High-Speed Photography.
                        LAYOUT: Blurred nature/plantation background (Golden Hour or Icy bokeh). Dynamic diagonal composition. The [FOOD] cuts through a chaotic vortex of liquid and ice.
                        MAIN IMAGE: The [FOOD] flying diagonally, creating a massive splash/inferno of liquid.
                        EFFECTS: Translucent liquid glowing like gold/crystal, Crystal clear ice cubes colliding in mid-air creating frosty mist, Heavy condensation droplets on product, Micro-bubbles inside the liquid splash.
                        LIGHTING: Strong backlighting passing through the liquid making it glow.
                        COLORS: Matches the drink color (e.g. Gold/Amber or Blue/Green).
                        `;
                    }
                    // 3. Epic Macro Landscape (For Bars/Solid Cakes)
                    else if (category === 'SolidBar') {
                        specificTemplate = `
                        TYPE: Food Poster - Epic Macro Landscape.
                        VISUAL TONE: Majestic, Hyper-detailed, Mouth-watering, Golden-Hour Warmth.
                        LAYOUT: Blurred warm luxury bokeh background. Low-angle 'Ant-eye view' looking up at a massive towering [FOOD] that is snapping/breaking in half.
                        MAIN IMAGE: A giant [FOOD] snapping dramatically in the center like a breaking mountain cliff. Inner texture visible on the flying chunks.
                        EFFECTS: Whole ingredients (nuts/choc chips) flying out from the core like meteors, A shockwave of fine powder/crumbs exploding outward, Sharp rough textures on broken edges, Motion blur on smaller particles.
                        LIGHTING: Backlit by a warm 'Golden Hour' sun, creating cinematic rim lights.
                        COLORS: Rich Browns, Golds, Warm Accents.
                        `;
                    }
                    // 4. Macro Product Burst (For Small Treats/Candy or General Sweet)
                    else {
                        specificTemplate = `
                        TYPE: Food Poster - Macro Product Burst.
                        VISUAL TONE: Indulgent, Rich, Warm, High-speed Liquid Motion, Luxurious.
                        LAYOUT: Dark vignette background to make the product pop. Center explosion composition.
                        MAIN IMAGE: A single [FOOD] piece cracking open dramatically at the center. From the cracks, a massive explosion of filling/liquid bursts outwards.
                        EFFECTS: Fragments of the product mixing with the liquid/cream, Stretchy sticky texture strings flying dramatically, Thick melted droplets suspended in air, Soft swirling sweet steam/mist.
                        LIGHTING: Warm golden studio lighting creating rich specular highlights.
                        COLORS: Gold, Caramel, Dark Brown, Vibrant product colors.
                        `;
                    }

                    return `Bertindaklah sebagai desainer poster makanan profesional 8K.
                    Product: ${productName}.
                    Genereate Image based on this JSON-Style Concept:
                    ${specificTemplate.replace(/\[FOOD\]/g, productName)}
                    
                    TYPOGRAPHY INSTRUCTION (MANDATORY):
                    Add a BOLD, STYLISH TITLE overlay: "${creativeTitle}".
                    Add a price tag/badge if appropriate (e.g. "15K" or "PROMO").
                    Font style must match the Visual Tone (e.g. Distressed/Fire for Spicy, Elegant/Serif for Sweet, Bold/Sans for Drink).
                    Ensure text is integrated into the design but readable.`;
                }

                // --- STANDARD LOGIC FOR OTHER STYLES ---
                let textInstruction = "";
                if (isTextRequired) {
                    textInstruction = `ANDA WAJIB MENAMBAHKAN TEKS/TIPOGRAFI ESTETIK PADA GAMBAR. 
                    Karena makanan ini terdeteksi sebagai ${flavor}, gunakan kata kunci seperti: "${keywords}" atau nama makanan "${productName}".
                    Pastikan teks sesuai dengan nuansa rasa (Manis=Playful/Elegant, Pedas=Bold/Fiery).`;
                } else {
                    textInstruction = "JANGAN tambahkan teks pada gambar. Biarkan gambar bersih tanpa tulisan.";
                }

                // Replace placeholders
                let processedPrompt = basePrompt.replace(/\[FOOD\]/g, productName);
                processedPrompt = processedPrompt.replace(/\[KEYWORDS\]/g, keywords);

                return `Bertindaklah sebagai fotografer makanan profesional. Ubah foto makanan ini menjadi level profesional. 
                Objek: ${productName}. Deteksi Rasa: ${flavor}.
                Style: ${processedPrompt}. 
                ${textInstruction}
                Pastikan makanan utama tetap menjadi fokus.`;
            };

            return (
                <div className="max-w-6xl mx-auto p-4 md:p-8">
                    
                    {/* Header */}
                    <header className="mb-8 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Camera className="w-8 h-8 text-orange-500" />
                            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 font-serif-display">FoodProduct AI</h1>
                        </div>
                        <p className="text-gray-500">Generator Foto Makanan Profesional: Poster, Cinematic, Resto, Iklan & Model</p>
                    </header>

                    <div className="grid md:grid-cols-12 gap-8">
                        
                        {/* LEFT COLUMN: Controls & Input */}
                        <div className="md:col-span-4 space-y-6">
                            
                            {/* Upload Section */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h2 className="font-semibold mb-4 flex items-center gap-2"><Upload className="w-4 h-4"/> 1. Upload Foto Asli</h2>
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-400 transition cursor-pointer relative bg-gray-50">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={handleImageUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    {originalImage ? (
                                        <img src={originalImage} alt="Original" className="max-h-48 mx-auto rounded-lg shadow-sm" />
                                    ) : (
                                        <div className="text-gray-400 flex flex-col items-center">
                                            <ImageIcon className="w-10 h-10 mb-2" />
                                            <span className="text-sm">Klik untuk upload foto makanan</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Product Name Input */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h2 className="font-semibold mb-2 flex items-center gap-2"><ChefHat className="w-4 h-4"/> 2. Deskripsi atau Konsep Foto</h2>
                                <input 
                                    type="text" 
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    placeholder="Contoh: Mie Goreng Pedas dengan suasana hangat..."
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>

                            {/* Aspect Ratio Selector */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h2 className="font-semibold mb-3 flex items-center gap-2"><Crop className="w-4 h-4"/> 3. Pilih Rasio Foto</h2>
                                <div className="grid grid-cols-2 gap-2">
                                    {ratios.map(r => (
                                        <button 
                                            key={r.value}
                                            onClick={() => setAspectRatio(r.value)}
                                            className={`py-2 px-3 rounded-lg text-sm border transition-all text-center ${
                                                aspectRatio === r.value 
                                                ? 'bg-orange-100 border-orange-500 text-orange-700 font-bold' 
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Generation Mode Tabs */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h2 className="font-semibold mb-4 flex items-center gap-2"><Wand2 className="w-4 h-4"/> 4. Mode Generate</h2>
                                
                                {/* ULTIMATE BUTTON */}
                                <button
                                    onClick={generateUltimatePack}
                                    disabled={loading || !originalImage || !productName}
                                    className={`w-full py-4 mb-2 rounded-xl font-bold text-white shadow-lg transform transition active:scale-95 flex flex-col items-center justify-center gap-1
                                        ${loading ? 'bg-gray-800 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-200'}
                                    `}
                                >
                                    {loading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <div className="flex items-center gap-2 text-lg">
                                           <Zap className="w-5 h-5 fill-yellow-300 text-yellow-300" /> ULTIMATE PACK
                                        </div>
                                    )}
                                    <span className="text-xs font-normal opacity-90">
                                        {loading ? loadingStatus : "Generate 20 Foto (5 Gaya x 4 Variasi)"}
                                    </span>
                                </button>
                            </div>
                            
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2 text-wrap break-words">
                                    <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <div>{error}</div>
                                </div>
                            )}

                        </div>

                        {/* RIGHT COLUMN: Results Grid */}
                        <div className="md:col-span-8">
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[600px] p-6 bg-checkered">
                                
                                {Object.keys(results).length === 0 && !loading && (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 min-h-[400px]">
                                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Layers className="w-8 h-8 opacity-50" />
                                        </div>
                                        <p className="text-lg font-medium">Siap Membuat Foto</p>
                                        <p className="text-sm opacity-70">Tekan "ULTIMATE PACK" untuk 20 variasi lengkap.</p>
                                    </div>
                                )}
                                
                                {loading && Object.keys(results).length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center min-h-[400px]">
                                        <div className="relative w-24 h-24 mb-4">
                                            {originalImage && <img src={originalImage} className="w-full h-full object-cover rounded-lg opacity-50 filter blur-sm" alt="Original Food" />}
                                            <div className="animate-scan"></div>
                                        </div>
                                        <p className="text-orange-600 font-medium animate-pulse">{loadingStatus || "Memproses..."}</p>
                                    </div>
                                )}

                                {/* Categorized Results Display */}
                                <div className="space-y-12">
                                    {(Object.entries(results) as [string, (string | null)[]][]).map(([category, images]) => (
                                        <div key={category} className="animate-fade-in-up">
                                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                                                <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                                                {category}
                                            </h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {images.map((imgSrc, idx) => {
                                                    const promptKey = `${category}-${idx}`;
                                                    const hasPromptData = videoPromptData[promptKey];
                                                    const isRegenerating = regenerating && regenerating.category === category && regenerating.index === idx;
                                                    const isGeneratingText = generatingText === promptKey;
                                                    
                                                    return (
                                                        <div key={idx} className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
                                                            {/* Image Container */}
                                                            <div className="relative group bg-gray-900 aspect-video overflow-hidden">
                                                                {imgSrc ? (
                                                                    <img src={imgSrc} alt={`${category} ${idx}`} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                                                                        <ImageIcon className="w-10 h-10"/>
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Hover Overlay */}
                                                                {imgSrc && (
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-2 text-center backdrop-blur-sm">
                                                                        <div className="flex gap-2">
                                                                            <button 
                                                                                onClick={() => setPreviewImage(imgSrc)}
                                                                                className="w-10 h-10 bg-white/20 hover:bg-white text-white hover:text-gray-900 rounded-full flex items-center justify-center transition-all shadow-lg"
                                                                                title="Lihat Fullsize"
                                                                            >
                                                                                <Eye className="w-5 h-5" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => downloadImage(imgSrc, `${productName}-${category}-${idx + 1}.jpg`)}
                                                                                className="w-10 h-10 bg-white/20 hover:bg-white text-white hover:text-gray-900 rounded-full flex items-center justify-center transition-all shadow-lg"
                                                                                title="Download"
                                                                            >
                                                                                <Download className="w-5 h-5" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => regenerateSingleImage(category, idx)}
                                                                                disabled={isRegenerating}
                                                                                className={`w-10 h-10 bg-white/20 hover:bg-white text-white hover:text-gray-900 rounded-full flex items-center justify-center transition-all shadow-lg ${isRegenerating ? 'animate-spin opacity-50 cursor-not-allowed' : ''}`}
                                                                                title="Buat Ulang (Refresh)"
                                                                            >
                                                                                <RefreshCw className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Loading State */}
                                                                {isRegenerating && (
                                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                                                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* AI Prompt Generator Section */}
                                                            <div className="p-4 bg-gray-50 border-t flex-1 flex flex-col justify-end">
                                                                {!hasPromptData ? (
                                                                    <button 
                                                                        onClick={() => generateVideoContext(category, idx)}
                                                                        disabled={isGeneratingText || !imgSrc}
                                                                        className="w-full py-2 bg-white border border-indigo-200 text-indigo-600 text-sm font-semibold rounded-lg hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                                                                    >
                                                                        {isGeneratingText ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Video className="w-4 h-4" />
                                                                        )}
                                                                        {isGeneratingText ? 'Sedang Menulis...' : '🎬 Buat Prompt Video & Script'}
                                                                    </button>
                                                                ) : (
                                                                    <div className="space-y-3 text-xs">
                                                                        <div>
                                                                            <div className="flex justify-between items-center mb-1">
                                                                                <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Visual Prompt</span>
                                                                                <button onClick={() => copyToClipboard(renderSafeText(hasPromptData.visual))} className="text-gray-400 hover:text-indigo-600"><Copy className="w-3 h-3"/></button>
                                                                            </div>
                                                                            <div className="bg-white p-2 rounded border text-gray-600 line-clamp-3 hover:line-clamp-none transition-all cursor-pointer border-l-2 border-l-indigo-500">
                                                                                {renderSafeText(hasPromptData.visual)}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="flex justify-between items-center mb-1">
                                                                                <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Dialog / Script</span>
                                                                                 <button onClick={() => copyToClipboard(renderSafeText(hasPromptData.script))} className="text-gray-400 hover:text-indigo-600"><Copy className="w-3 h-3"/></button>
                                                                            </div>
                                                                            <div className="bg-white p-2 rounded border text-gray-600 line-clamp-3 hover:line-clamp-none transition-all cursor-pointer border-l-2 border-l-green-500 italic">
                                                                                {renderSafeText(hasPromptData.script)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {loading && Object.keys(results).length > 0 && (
                                    <div className="mt-8 text-center py-4 bg-orange-50 rounded-lg border border-orange-100">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                                        <p className="text-orange-600 font-medium">{loadingStatus}</p>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>

                    {/* Image Preview Modal */}
                    {previewImage && (
                        <div 
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 transition-opacity duration-300"
                            onClick={() => setPreviewImage(null)}
                        >
                            <div className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center">
                                <button 
                                    className="absolute -top-12 right-0 text-white hover:text-orange-500 transition-colors"
                                    onClick={() => setPreviewImage(null)}
                                >
                                    <X className="w-8 h-8" />
                                </button>
                                <img 
                                    src={previewImage} 
                                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
                                    onClick={(e) => e.stopPropagation()} 
                                    alt="Preview"
                                />
                            </div>
                        </div>
                    )}

                </div>
            );
        };

export default FoodDrinkGenerator;