const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

console.log("API KEY cargada:", process.env.OPENROUTER_API_KEY);

app.use(cors());
app.use(express.json());

app.post('/api/receta', async (req, res) => {
  const { ingredientes } = req.body;
  if (!ingredientes) {
    return res.status(400).json({ error: 'Faltan ingredientes en la solicitud.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY no está configurada.');
    return res.status(500).json({ error: 'Error de configuración del servidor.' });
  }

  const prompt = `
Tengo los siguientes ingredientes en casa: ${ingredientes}.
Por favor, dame una receta clara y fácil de preparar usando estos ingredientes.
Incluye una lista de pasos para cocinar, tiempo estimado y consejos útiles.
Por favor, escribe sin errores ortográficos ni gramaticales.
`;

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "google/gemma-2b-it",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'EasyFoodAI'
        }
      }
    );

    const receta = response.data.choices[0].message.content;
    res.json({ receta });
  } catch (error) {
    console.error('Error al obtener receta:', error.response?.data || error.message);
    let errorMessage = 'Hubo un problema al generar la receta.';
    if (error.response?.data?.error?.message) {
      errorMessage = `Error de la API: ${error.response.data.error.message}`;
    } else if (error.message) {
      errorMessage = `Error de red: ${error.message}`;
    }
    res.status(500).json({ error: errorMessage });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});