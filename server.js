const express = require("express");
const cors = require("cors");
const multer = require("multer");

// Configuração do Multer (guarda o ficheiro na memória para Vercel Serverless)
const upload = multer({ storage: multer.memoryStorage() });

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({ origin: '*' }));

// ==========================================
// CHAVES MESTRAS (Puxadas com segurança da Vercel)
// ==========================================
const HF_TOKEN = process.env.HF_TOKEN;
const COHERE_API_KEY = process.env.COHERE_API_KEY; 

// =============================
// ROTA RAIZ
// =============================
app.get("/", (req, res) => {
    res.send("🚀 Servidor da A&M IA está ONLINE usando os motores de IA!");
});

// =============================
// ROTA CHAT (COHERE)
// =============================
app.post("/api/chat", async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Mensagem não fornecida." });
    }

    try {
        if (!COHERE_API_KEY) {
            return res.status(500).json({ error: "Chave da Cohere não configurada no servidor Vercel." });
        }

        const cohereResponse = await fetch("https://api.cohere.ai/v1/chat", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${COHERE_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ message })
        });

        if (!cohereResponse.ok) {
            const errorData = await cohereResponse.text();
            console.error("Erro na API da Cohere:", errorData);
            return res.status(500).json({ error: "Falha ao comunicar com a inteligência artificial." });
        }

        const data = await cohereResponse.json();
        res.json({ reply: data.text });
        
    } catch (err) {
        console.error("Erro interno:", err);
        res.status(500).json({ error: "Falha no servidor." });
    }
});

// ===============================================
// ROTA TRANSCRIÇÃO (HUGGING FACE - Whisper Small)
// ===============================================
app.post("/api/transcribe", upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro multimédia recebido." });

    try {
        if (!HF_TOKEN) return res.status(500).json({ error: "Chave do Hugging Face ausente na Vercel." });

        console.log("A enviar áudio para a Hugging Face. Tamanho:", req.file.size);

        // MUDANÇA 1: Usar o whisper-small para evitar timeouts e limites de memória
        const response = await fetch("https://api-inference.huggingface.co/models/openai/whisper-small", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": req.file.mimetype || "audio/wav"
            },
            body: req.file.buffer 
        });

        if (!response.ok) {
            // MUDANÇA 2: Capturar a resposta exata em texto para não perder o erro
            const errText = await response.text();
            let errData = {};
            try { errData = JSON.parse(errText); } catch(e) {}
            
            console.error("Resposta de Erro da Hugging Face:", errText);
            
            // Se a IA estiver adormecida, avisa o aluno do tempo exato de espera
            if (errData.estimated_time) {
                return res.status(503).json({ 
                    error: `A IA de áudio está a iniciar. Tente novamente em ${Math.round(errData.estimated_time)} segundos.` 
                });
            }
            
            // Devolve a mensagem real da Hugging Face para o ecrã em vez de um erro genérico
            throw new Error(errData.error || errText || "Falha desconhecida na API da Hugging Face.");
        }

        const data = await response.json();
        res.json({ text: data.text });

    } catch (err) {
        console.error("Erro na rota /transcribe:", err.message);
        res.status(500).json({ error: err.message || "Erro interno ao processar o ficheiro." });
    }
});

// =============================
// ROTA GERAÇÃO DE IMAGEM (HUGGING FACE - Stable Diffusion)
// =============================
app.post("/api/generate-image", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "Prompt da imagem não fornecido." });

    try {
        if (!HF_TOKEN) return res.status(500).json({ error: "Chave do Hugging Face ausente na Vercel." });

        const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ inputs: prompt })
        });

        if (!response.ok) throw new Error("Falha ao gerar imagem na Hugging Face.");
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        res.json({
            predictions: [
                { bytesBase64Encoded: base64Image }
            ]
        });
        
    } catch (err) {
        console.error("Erro ao gerar imagem:", err);
        res.status(500).json({ error: "Falha na geração de imagem." });
    }
});



// ===============================================
// ROTA TRANSCRIÇÃO (HUGGING FACE - Whisper Large V3)
// ===============================================
app.post("/api/transcribe", upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro multimédia enviado." });

    try {
        if (!HF_TOKEN) return res.status(500).json({ error: "Chave do Hugging Face ausente na Vercel." });

        const response = await fetch("https://api-inference.huggingface.co/models/openai/whisper-large-v3", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": req.file.mimetype // <-- CORREÇÃO 1: Dizer à HF que é um ficheiro de áudio
            },
            body: req.file.buffer 
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            
            // <-- CORREÇÃO 2: Se a IA estiver a acordar, avisa o frontend para tentar novamente
            if (errData.estimated_time) {
                return res.status(503).json({ 
                    error: `A IA de áudio está a iniciar. Tente novamente em ${Math.round(errData.estimated_time)} segundos.`,
                    estimated_time: errData.estimated_time
                });
            }
            throw new Error(errData.error || "Falha na API da Hugging Face.");
        }

        const data = await response.json();
        res.json({ text: data.text });

    } catch (err) {
        console.error("Erro na transcrição:", err.message);
        // Devolve o erro exato para sabermos o que falhou
        res.status(500).json({ error: err.message || "Erro interno ao processar o ficheiro multimédia." });
    }
});


// ===============================================
// ROTA DE GERAÇÃO DE VÍDEO (EXPERIMENTAL)
// ===============================================
app.post("/api/generate-video", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "Prompt do vídeo não fornecido." });

    try {
        if (!HF_TOKEN) return res.status(500).json({ error: "Chave do Hugging Face ausente na Vercel." });

        const response = await fetch("https://api-inference.huggingface.co/models/damo-vilab/text-to-video-ms-1.7b", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ inputs: prompt })
        });

        if (!response.ok) {
            const err = await response.json();
            if (err.estimated_time) {
                return res.status(503).json({ error: `O modelo de vídeo está ligando. Tente novamente em ${Math.round(err.estimated_time)} segundos.` });
            }
            throw new Error("Falha ao gerar vídeo.");
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Video = buffer.toString('base64');

        res.json({ videoBase64: base64Video });
        
    } catch (err) {
        console.error("Erro ao gerar vídeo:", err);
        res.status(500).json({ error: "Falha na geração de vídeo. Pode ser limite de tempo da Vercel." });
    }
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor a correr localmente na porta ${PORT}`);
    });
}
