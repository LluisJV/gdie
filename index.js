
//express test code
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";


const app = express();
const port = process.env.PORT || 80; // Usar el puerto de la variable de entorno o 80 por defecto

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

          ws.send(
            JSON.stringify({
              type: "ack",
              action: data.action,
              value: data.value,
            })
          );

          // Reenviar el comando a todos los demás clientes
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "command",
                  action: data.action,
                  value: data.value,
                })
              );

            }
          });
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

