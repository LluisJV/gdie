/**
 * Cliente para interactuar con la API de recomendaciones a través del servidor
 */

const API_ENDPOINT = '/api/gemini/recomendacion';

/**
 * Obtiene una recomendación de ciudad basada en las respuestas del cuestionario
 * @param {Object} respuestas - Las respuestas del usuario al cuestionario
 * @returns {Promise<Object>} - Promesa que resuelve con la recomendación
 */
async function obtenerRecomendacionGemini(respuestas) {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 segundo de espera entre reintentos
  const requestTimeout = 30000; // 30 segundos de timeout

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      console.log(`Intento ${attempt} de ${maxRetries}: Enviando solicitud al servidor`);
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ respuestas }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Error del servidor: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log('Respuesta del servidor recibida:', data);
      
      return data;

    } catch (error) {
      console.error(`Error en el intento ${attempt}:`, error);
      clearTimeout(timeoutId);

      // Si es un error de timeout o del servidor, reintentamos
      if (
        (error.name === 'AbortError' || 
         error.message.includes('503') || 
         error.message.includes('timeout') ||
         error.message.includes('Failed to fetch')) && 
        attempt < maxRetries
      ) {
        console.log(`Reintentando en ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      if (attempt === maxRetries) {
        console.error('Error al obtener recomendación después de todos los intentos:', error);
        // Fallback en caso de error
        return {
          ciudadRecomendada: 'Madrid',
          razonamiento: 'Ocurrió un error al generar la recomendación. Por defecto, se recomienda la capital de España.',
          descripcion: 'Madrid, la vibrante capital de España, ofrece una mezcla de historia, cultura y vida urbana moderna.'
        };
      }
    }
  }
}

// Exponer la función para usarla desde otros archivos
window.obtenerRecomendacionGemini = obtenerRecomendacionGemini;
