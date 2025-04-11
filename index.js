// Importar módulos usando la sintaxis de importación ES Modules
import { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';

const app = express();
const port = 80;

// Crear servidor HTTP usando la app de Express
const server = http.createServer(app);

// Poner los archivos estáticos en la carpeta public
app.use(express.static("public"));

// Configurar servidor WebSocket
const wss = new WebSocketServer({ server });

// Manejar conexiones WebSocket
wss.on("connection", (ws) => {
  console.log("Cliente conectado al WebSocket");

  // Enviar mensaje de bienvenida
  ws.send(JSON.stringify({
    type: "system",
    message: "Conectado al servidor de control remoto",
  }));

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Mensaje recibido:", data);

      // Procesar comandos del control remoto
      switch (data.action) {
        case "play":
        case "pause":
        case "seek":
        case "volume":
          // Enviar confirmación al cliente
          ws.send(JSON.stringify({
            type: "ack",
            action: data.action,
            value: data.value,
          }));

          // Reenviar el comando a todos los demás clientes
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === ws.OPEN) {
              client.send(JSON.stringify({
                type: "command",
                action: data.action,
                value: data.value,
              }));
            }
          });
          break;

        default:
          ws.send(JSON.stringify({
            type: "error",
            message: "Comando no reconocido",
          }));
      }
    } catch (err) {
      console.error("Error al procesar mensaje:", err);
      ws.send(JSON.stringify({
        type: "error",
        message: "Error al procesar el comando",
      }));
    }
  });

  ws.on("close", () => {
    console.log("Cliente desconectado del WebSocket");
  });

  ws.on("error", (error) => {
    console.error("Error de WebSocket:", error);
  });
});

// Iniciar el servidor HTTP y WebSocket
server.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
  console.log(`Servidor WebSocket ejecutándose en ws://localhost:${port}`);
});
