/**
 * Integración con Google Gemini 2.0 Flash API
 */

const GEMINI_API_KEY = "AIzaSyBhfBzulR5yU1kAdBeb6NIEOw0qC8PGV5U";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Genera una recomendación de ciudad basada en las respuestas del cuestionario
 * @param {Object} respuestas - Las respuestas del usuario al cuestionario
 * @returns {Promise<Object>} - Promesa que resuelve con la respuesta de Gemini
 */
async function obtenerRecomendacionGemini(respuestas) {
  try {
    // Convertir las respuestas a un formato más amigable para el prompt
    const respuestasFormateadas = Object.entries(respuestas)
      .map(
        ([pregunta, respuesta]) =>
          `- A la pregunta "${pregunta}", respondió: "${respuesta}"`
      )
      .join("\n");

    // Construir el prompt para Gemini
    const prompt = `
Actúa como un experto en turismo español que recomienda la ciudad ideal en España basada en las preferencias de un usuario.
Basado en las siguientes respuestas de un cuestionario, recomienda UNA ciudad española entre Madrid, Barcelona, Valencia o Palma.

Respuestas del usuario:
${respuestasFormateadas}

IMPORTANTE: Tu respuesta debe ser devuelta en un formato de objeto JSON con los campos solicitados.
`;

    console.log("Enviando prompt a Gemini:", prompt);

    // Configurar la petición a la API de Gemini según el formato correcto
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              ciudadRecomendada: {
                type: "string",
                description:
                  "El nombre de la ciudad recomendada (Madrid, Barcelona, Valencia o Palma)",
              },
              razonamiento: {
                type: "string",
                description:
                  "Una explicación breve (máximo 2 frases) de por qué has elegido esta ciudad",
              },
              descripcion: {
                type: "string",
                description:
                  "Una descripción atractiva de la ciudad (máximo 2 frases)",
              },
            },
            required: ["ciudadRecomendada", "razonamiento", "descripcion"],
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Error en la API de Gemini: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("Respuesta de Gemini:", data);

    // Extraer el JSON de la respuesta
    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      const respuestaParte = data.candidates[0].content.parts[0];

      // Comprobar si la respuesta es un objeto JSON
      if (respuestaParte.jsonValue) {
        return respuestaParte.jsonValue;
      } else if (respuestaParte.text) {
        // Intentar parsear el texto como JSON
        try {
          const jsonRespuesta = JSON.parse(respuestaParte.text.trim());
          return jsonRespuesta;
        } catch (jsonError) {
          console.error(
            "Error al parsear la respuesta JSON de Gemini:",
            jsonError
          );
          throw new Error("La respuesta no está en formato JSON válido");
        }
      } else {
        throw new Error("Formato de respuesta inesperado");
      }
    } else {
      throw new Error("No se recibieron candidatos en la respuesta");
    }
  } catch (error) {
    console.error("Error al obtener recomendación de Gemini:", error);

    // Fallback en caso de error en la API
    return {
      ciudadRecomendada: "Madrid",
      razonamiento:
        "Ocurrió un error al generar la recomendación. Por defecto, se recomienda la capital de España.",
      descripcion:
        "Madrid, la vibrante capital de España, ofrece una mezcla de historia, cultura y vida urbana moderna.",
    };
  }
}

// Exponer la función para usarla desde otros archivos
window.obtenerRecomendacionGemini = obtenerRecomendacionGemini;
