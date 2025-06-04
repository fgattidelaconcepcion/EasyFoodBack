// index.js (tu archivo de backend)

const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); // Carga las variables de entorno del archivo .env

const app = express();
// Configura el puerto para que use la variable de entorno de Render (process.env.PORT)
// o 3000 si se ejecuta localmente (para desarrollo).
const PORT = process.env.PORT || 3000;

// Middleware para permitir CORS (Cross-Origin Resource Sharing).
// Esto es crucial para que tu aplicación React Native pueda comunicarse con tu backend.
app.use(cors());
// Middleware para parsear el cuerpo de las solicitudes como JSON.
app.use(express.json());

// ---

// Verifica si la API Key está cargada al iniciar el servidor.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (OPENROUTER_API_KEY) {
  console.log("✅ API KEY de OpenRouter cargada correctamente.");
} else {
  console.error('❌ ERROR: La variable de entorno OPENROUTER_API_KEY no está configurada.');
  console.error('Asegúrate de tenerla configurada en Render (en "Environment Variables") o en tu archivo .env local.');
  // Opcional: Podrías salir del proceso si la clave es crítica para que el servidor funcione.
  // process.exit(1);
}

// ---

// Ruta GET para la raíz del servidor (opcional, pero útil para probar en el navegador).
// Responde cuando alguien visita la URL base de tu backend (ej: https://easyfoodback.onrender.com/).
app.get('/', (req, res) => {
  res.send('¡El servidor de recetas EasyFood está funcionando! Envía una solicitud POST a /api/receta.');
});

// Ruta POST para generar recetas.
// Esta es la ruta que tu aplicación React Native llamará.
app.post('/api/receta', async (req, res) => {
  const { ingredientes } = req.body; // Obtiene los ingredientes del cuerpo de la solicitud.

  // Valida que se hayan proporcionado ingredientes.
  if (!ingredientes) {
    return res.status(400).json({ error: 'Faltan ingredientes en la solicitud.' });
  }

  // Vuelve a verificar la API Key justo antes de usarla en caso de que el servidor se haya iniciado sin ella.
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'Error interno del servidor: API Key no disponible.' });
  }

  // --- Construcción del "prompt" para la IA ---
  const prompt = `
Tengo los siguientes ingredientes en casa: ${ingredientes}.
Por favor, dame una receta clara y fácil de preparar usando estos ingredientes.
Incluye una lista de pasos para cocinar, tiempo estimado y consejos útiles.
Por favor, escribe sin errores ortográficos ni gramaticales.
`;

  // --- Realización de la solicitud a OpenRouter AI ---
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions', // Endpoint de la API de OpenRouter.
      {
        model: "google/gemma-2b-it", // Modelo de IA a utilizar.
        messages: [{ role: "user", content: prompt }] // El mensaje/prompt que se envía a la IA.
      },
      {
        headers: {
          // --- ESTA ES LA PARTE CLAVE: Incluir la API Key en los headers de autorización ---
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          // Headers opcionales recomendados por OpenRouter para identificación.
          'HTTP-Referer': 'http://localhost', // O el dominio real de tu aplicación si lo tienes.
          'X-Title': 'EasyFoodAI'
        }
      }
    );

    // Extrae el contenido de la receta de la respuesta de la IA.
    const receta = response.data.choices[0].message.content;
    // Envía la receta como respuesta JSON a tu aplicación React Native.
    res.json({ receta });

  } catch (error) {
    // --- Manejo de errores detallado ---
    console.error('Error al obtener receta de OpenRouter:', error.response?.data || error.message);

    let errorMessage = 'Hubo un problema desconocido al generar la receta.';
    if (error.response) {
      // Si hay una respuesta de error del servidor de OpenRouter.
      if (error.response.status === 401) {
        errorMessage = 'Error de autenticación con la API de OpenRouter. Verifica tu API Key y saldo.';
      } else if (error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = `Error de la API de OpenRouter: ${error.response.data.error.message}`;
      } else {
        errorMessage = `Error del servidor de OpenRouter: Código ${error.response.status}.`;
      }
    } else if (error.request) {
      // Si la solicitud fue hecha pero no hubo respuesta (problemas de red del backend a OpenRouter).
      errorMessage = 'No se pudo conectar con el servidor de OpenRouter. Revisa la conectividad de tu backend.';
    } else {
      // Otros errores (problemas de configuración de la solicitud Axios, etc.).
      errorMessage = `Error en la solicitud: ${error.message}`;
    }
    // Envía el error al cliente (tu app React Native) con un código de estado 500.
    res.status(500).json({ error: errorMessage });
  }
});

// --- Iniciar el servidor ---
app.listen(PORT, () => {
  // Mostrará el puerto real que Render le asigna (ej. 10000) o 3000 si es local.
  console.log(`✅ Servidor de EasyFood corriendo en el puerto ${PORT}`);
  console.log(`Listo para recibir solicitudes POST en /api/receta`);
});