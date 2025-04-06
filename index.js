//express test code
import express from "express"; // Correct import for ES modules
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

const app = express();
const port = 80;

// Crear servidor HTTP usando la app de Express
const server = http.createServer(app);

//pone los archivos estaticos en la carpeta public
//para acceder a index.html -> http://localhost/index.html
app.use(express.static("public"));

// Configurar servidor WebSocket
const wss = new WebSocketServer({ server });

// Manejar conexiones WebSocket
wss.on("connection", (ws) => {
  console.log("Cliente conectado al WebSocket");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Mensaje recibido:", data);

      // Reenviar el mensaje a todos los clientes conectados
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });
    } catch (err) {
      console.error("Error al procesar mensaje:", err);
    }
  });

  ws.on("close", () => {
    console.log("Cliente desconectado del WebSocket");
  });
});

// Iniciar el servidor HTTP y WebSocket
server.listen(port, () => {
  console.log("Servidor ejecutándose en puerto: " + port);
  console.log("Servidor WebSocket ejecutándose");
});
