// index.js (tu archivo de backend)

// Importa los módulos necesarios
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); // Carga las variables de entorno del archivo .env

// Inicializa la aplicación Express
const app = express();

// Configura el puerto para que use la variable de entorno de Render (process.env.PORT)
// Esto es crucial para que Render pueda asignar un puerto a tu aplicación.
// Si se ejecuta localmente (para desarrollo), usará el puerto 3000.
const PORT = process.env.PORT || 3000;

// --- Middlewares ---

// Habilita CORS (Cross-Origin Resource Sharing).
// Esto permite que tu aplicación React Native (que tiene un origen diferente)
// pueda hacer solicitudes a este backend.
app.use(cors());

// Permite que Express parsee el cuerpo de las solicitudes como JSON.
// Esto es necesario para leer los 'ingredientes' enviados desde el frontend.
app.use(express.json());

// --- Verificación de la API Key al inicio del servidor ---

// Obtiene la API Key de OpenRouter de las variables de entorno.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Muestra un mensaje en la consola del servidor (útil para depuración en Render logs).
if (OPENROUTER_API_KEY) {
  console.log("✅ API Key de OpenRouter cargada correctamente.");
} else {
  console.error('❌ ERROR: La variable de entorno OPENROUTER_API_KEY no está configurada.');
  console.error('Asegúrate de haberla configurado en Render (en la sección "Environment Variables") o en tu archivo .env local.');
  // Opcional: podrías considerar salir del proceso aquí si la API Key es crítica para el funcionamiento.
  // process.exit(1);
}

// --- Rutas de la API ---

// Ruta GET para la raíz del servidor (/).
// Esta ruta es opcional, pero útil para verificar si el servidor está "vivo"
// al visitar su URL base en un navegador (ej: https://easyfoodback.onrender.com/).
app.get('/', (req, res) => {
  res.send('¡El servidor de recetas EasyFood está funcionando! Envía una solicitud POST a /api/receta.');
});

// Ruta POST para generar recetas.
// Esta es la ruta principal que tu aplicación React Native llamará.
app.post('/api/receta', async (req, res) => {
  // Obtiene los ingredientes enviados en el cuerpo de la solicitud (JSON).
  const { ingredientes } = req.body;

  // Valida que se hayan proporcionado ingredientes.
  if (!ingredientes) {
    return res.status(400).json({ error: 'Faltan ingredientes en la solicitud.' });
  }

  // Vuelve a verificar la API Key justo antes de usarla.
  // Esto es una capa de seguridad adicional en caso de un inicio defectuoso.
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'Error interno del servidor: API Key no disponible.' });
  }

  // --- Construcción del "prompt" para la Inteligencia Artificial ---
  // Este es el texto que se envía a la IA para que genere la receta.
  const prompt = `
Tengo los siguientes ingredientes en casa: ${ingredientes}.
Por favor, dame una receta clara y fácil de preparar usando estos ingredientes.
Incluye una lista de pasos para cocinar, tiempo estimado y consejos útiles.
Por favor, escribe sin errores ortográficos ni gramaticales.
`;

  // --- Realización de la solicitud a la API de OpenRouter AI ---
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions', // URL del endpoint de OpenRouter para chat completions.
      {
        model: "google/gemma-2b-it", // Define el modelo de IA a utilizar (Gemma 2B Instruct).
        messages: [{ role: "user", content: prompt }] // El mensaje del usuario para la IA.
      },
      {
        headers: {
          // *** CLAVE PARA LA AUTENTICACIÓN: Incluye la API Key en el encabezado de autorización. ***
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          // Headers opcionales recomendados por OpenRouter para identificación y referer.
          'HTTP-Referer': 'http://localhost', // Puedes cambiar esto al dominio de tu app si es un sitio web.
          'X-Title': 'EasyFoodAI' // Título de tu aplicación para las estadísticas de OpenRouter.
        }
      }
    );

    // Extrae el contenido de la receta de la respuesta de la IA.
    // La estructura de la respuesta puede variar ligeramente entre APIs de IA.
    const receta = response.data.choices[0].message.content;
    // Envía la receta generada como respuesta JSON a tu aplicación React Native.
    res.json({ receta });

  } catch (error) {
    // --- Manejo de errores detallado ---
    // Registra el error completo en la consola del servidor para depuración.
    console.error('Error al obtener receta de OpenRouter:', error.response?.data || error.message);

    let errorMessage = 'Hubo un problema desconocido al generar la receta.';
    if (error.response) {
      // Si el error proviene de la respuesta del servidor de OpenRouter (ej: 401, 400, 500).
      if (error.response.status === 401) {
        errorMessage = 'Error de autenticación con la API de OpenRouter. Verifica tu API Key y asegúrate de tener saldo.';
      } else if (error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = `Error de la API de OpenRouter: ${error.response.data.error.message}`;
      } else {
        errorMessage = `Error del servidor de OpenRouter: Código ${error.response.status}.`;
      }
    } else if (error.request) {
      // Si la solicitud se hizo, pero no hubo respuesta (problemas de red entre tu backend y OpenRouter).
      errorMessage = 'No se pudo conectar con el servidor de OpenRouter. Revisa la conectividad de tu backend.';
    } else {
      // Otros tipos de errores (ej: problemas de configuración de la solicitud Axios).
      errorMessage = `Error en la solicitud: ${error.message}`;
    }
    // Envía el mensaje de error al cliente (tu app React Native) con un código de estado 500.
    res.status(500).json({ error: errorMessage });
  }
});

// --- Iniciar el servidor ---
// El servidor comienza a escuchar en el puerto configurado.
app.listen(PORT, () => {
  // Muestra el puerto real en el que el servidor está escuchando (en Render será dinámico, ej. 10000).
  console.log(`✅ Servidor de EasyFood corriendo en el puerto ${PORT}`);
  console.log(`Listo para recibir solicitudes POST en /api/receta`);
});