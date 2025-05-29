//express test code
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

const app = express();
const port = process.env.PORT || 80; // Usar el puerto de la variable de entorno o 80 por defecto

// Sistema de salas para emparejar controles remotos con pantallas
const rooms = new Map(); // Map para almacenar las salas: código -> [clientes_ws]
const clientRooms = new Map(); // Map para asociar clientes con sus salas: cliente_ws -> código

// Función para generar un código aleatorio de 4 dígitos
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Configurar CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Crear servidor HTTP usando la app de Express
const server = http.createServer(app);

// Poner los archivos estáticos en la carpeta public
app.use(express.static("public"));

// Middleware para parsear JSON
app.use(express.json());

// Configuración de la API de Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBhfBzulR5yU1kAdBeb6NIEOw0qC8PGV5U";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Endpoint para obtener recomendaciones
app.post('/api/gemini/recomendacion', async (req, res) => {
  try {
    const { respuestas } = req.body;
    
    if (!respuestas) {
      return res.status(400).json({ 
        error: 'Se requieren respuestas para generar una recomendación' 
      });
    }

    // Convertir las respuestas a un formato más amigable para el prompt
    const respuestasFormateadas = Object.entries(respuestas)
      .map(([pregunta, respuesta]) => 
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

    console.log('Enviando solicitud a Gemini API...');
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
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
                description: "El nombre de la ciudad recomendada (Madrid, Barcelona, Valencia o Palma)",
              },
              razonamiento: {
                type: "string",
                description: "Una explicación breve (máximo 2 frases) de por qué has elegido esta ciudad",
              },
              descripcion: {
                type: "string",
                description: "Una descripción atractiva de la ciudad (máximo 2 frases)",
              },
            },
            required: ["ciudadRecomendada", "razonamiento", "descripcion"],
          },
        },
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error de la API de Gemini:', error);
      return res.status(500).json({ 
        error: 'Error al obtener recomendación',
        details: error 
      });
    }

    const data = await response.json();
    console.log('Respuesta de Gemini recibida:', data);
    
    // Extraer la respuesta de Gemini
    const respuestaGemini = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!respuestaGemini) {
      throw new Error('Formato de respuesta inesperado de la API de Gemini');
    }

    // Intentar extraer el JSON de la respuesta
    try {
      // Buscar el primer { y el último } para extraer el JSON
      const jsonStart = respuestaGemini.indexOf('{');
      const jsonEnd = respuestaGemini.lastIndexOf('}') + 1;
      const jsonString = respuestaGemini.substring(jsonStart, jsonEnd);
      const resultado = JSON.parse(jsonString);
      
      return res.json(resultado);
    } catch (parseError) {
      console.error('Error al parsear la respuesta de Gemini:', parseError);
      // Si falla el parseo, devolver la respuesta en texto plano
      return res.json({
        ciudadRecomendada: 'No se pudo determinar',
        razonamiento: 'Hubo un error al procesar la respuesta',
        descripcion: respuestaGemini
      });
    }
  } catch (error) {
    console.error('Error en el endpoint de recomendación:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Configurar servidor WebSocket
const wss = new WebSocketServer({
  server,
  path: "/", // Asegurar que el path sea el mismo que en el cliente
  clientTracking: true, // Habilitar tracking de clientes
  verifyClient: (info, callback) => {
    console.log('Nueva conexión WebSocket desde:', info.req.headers['x-forwarded-for'] || info.req.socket.remoteAddress);
    // Aceptar todas las conexiones
    callback(true);
  }
});

// Manejar conexiones WebSocket
wss.on("connection", (ws, req) => {
  console.log("Cliente conectado al WebSocket");
  console.log("URL de conexión:", req.url);
  console.log("Headers:", req.headers);

  // Configurar el WebSocket para que no se cierre automáticamente
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Enviar mensaje de bienvenida
  ws.send(
    JSON.stringify({
      type: "system",
      message: "Conectado al servidor de control remoto",
    })
  );

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Mensaje recibido:", data);

      // Manejar mensajes de registro de cliente
      if (data.type === "register") {
        console.log(`Cliente registrado como: ${data.client}`);
        ws.clientType = data.client;

        // Si el cliente es una pantalla de video, generar un código de sala
        if (data.client === "video") {
          const roomCode = generateRoomCode();
          // Crear sala y asociar cliente con ella
          rooms.set(roomCode, [ws]);
          clientRooms.set(ws, roomCode);

          // Notificar al cliente su código de sala
          ws.send(
            JSON.stringify({
              type: "room",
              roomCode: roomCode,
              message: `Sala creada con código: ${roomCode}`,
            })
          );

          console.log(`Nueva sala creada con código: ${roomCode}`);
        }

        ws.send(
          JSON.stringify({
            type: "system",
            message: `Registrado como ${data.client}`,
          })
        );
        return;
      }

      // Manejar mensajes de unión a sala
      if (data.type === "joinRoom") {
        const roomCode = data.roomCode;
        console.log(`Cliente intenta unirse a la sala: ${roomCode}`);

        if (rooms.has(roomCode)) {
          // Añadir cliente a la sala
          const room = rooms.get(roomCode);
          room.push(ws);
          clientRooms.set(ws, roomCode);

          ws.send(
            JSON.stringify({
              type: "system",
              message: `Conectado a la sala ${roomCode}`,
            })
          );
          console.log(`Cliente añadido a la sala: ${roomCode}`);
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `La sala ${roomCode} no existe`,
            })
          );
          console.log(
            `Intento fallido de unirse a sala inexistente: ${roomCode}`
          );
        }
        return;
      }

      // Procesar comandos del control remoto
      switch (data.action) {
        case "play":
        case "pause":
        case "seek":
        case "volume":
          // Enviar confirmación al cliente
          ws.send(
            JSON.stringify({
              type: "ack",
              action: data.action,
              value: data.value,
            })
          );

          // Verificar si el cliente está en una sala
          const roomCode = clientRooms.get(ws);
          if (roomCode && rooms.has(roomCode)) {
            // Reenviar el comando solo a los clientes de la misma sala
            const roomClients = rooms.get(roomCode);
            let clientsNotified = 0;

            roomClients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: "command",
                    action: data.action,
                    value: data.value,
                  })
                );
                clientsNotified++;
              }
            });

            console.log(
              `Comando ${data.action} reenviado a ${clientsNotified} clientes en la sala ${roomCode}`
            );
          } else {
            console.log(`Cliente no está en ninguna sala o la sala no existe`);
          }
          break;

        default:
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Comando no reconocido",
            })
          );
      }
    } catch (err) {
      console.error("Error al procesar mensaje:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Error al procesar el comando",
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("Cliente desconectado del WebSocket");

    // Limpiar sala cuando un cliente se desconecta
    const roomCode = clientRooms.get(ws);
    if (roomCode && rooms.has(roomCode)) {
      const roomClients = rooms.get(roomCode);
      // Eliminar cliente de la sala
      const updatedClients = roomClients.filter((client) => client !== ws);

      if (updatedClients.length === 0) {
        // Si no quedan clientes, eliminar la sala
        console.log(`Eliminando sala vacía: ${roomCode}`);
        rooms.delete(roomCode);
      } else {
        // Actualizar lista de clientes en la sala
        rooms.set(roomCode, updatedClients);
      }
    }

    // Eliminar la asociación del cliente a la sala
    clientRooms.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("Error de WebSocket:", error);
  });
});

// Mantener las conexiones vivas
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

// Iniciar el servidor
server.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
