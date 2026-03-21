// ... existing code ...
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

        // NOVA LÓGICA: Capturar o erro REAL da Hugging Face
        if (!response.ok) {
            const errorData = await response.text();
            console.error("Erro REAL da Hugging Face:", errorData);
            return res.status(response.status).json({ error: `Recusado pela Hugging Face: ${errorData}` });
        }
        
        const arrayBuffer = await response.arrayBuffer();
// ... existing code ...
        const base64Image = buffer.toString('base64');

        res.json({
            predictions: [
                { bytesBase64Encoded: base64Image }
            ]
        });
        
    } catch (err) {
        console.error("Erro interno ao gerar imagem:", err);
        res.status(500).json({ error: "Falha interna do servidor: " + err.message });
    }
});

// ===============================================
// ROTA TRANSCRIÇÃO (HUGGING FACE - Whisper Large V3)
// ... existing code ...
