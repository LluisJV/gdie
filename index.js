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

// Configurar servidor WebSocket
const wss = new WebSocketServer({
  server,
  path: "/", // Asegurar que el path sea el mismo que en el cliente
  clientTracking: true, // Habilitar tracking de clientes
  verifyClient: (info, callback) => {
    // Aceptar todas las conexiones
    callback(true);
  },
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
