// Servidor WebSocket independiente para control remoto de video
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as dotenv from "dotenv";

// Cargar variables de entorno
dotenv.config();

// Configuración
const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// Crear servidor HTTP
const server = createServer((req, res) => {
  // Manejar solicitudes HTTP simples para health checks
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "ok", message: "WebSocket server is running" })
    );
    return;
  }

  // Redirigir a la página de documentación simple
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Control WebSocket Server</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { color: #333; }
          code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>Video Control WebSocket Server</h1>
        <p>Este servidor proporciona una conexión WebSocket para el control remoto de reproductores de video.</p>
        <p>Estado del servidor: <strong>Activo</strong></p>
        <p>Puerto: <code>${PORT}</code></p>
        <h2>Comandos soportados:</h2>
        <ul>
          <li><code>{ "action": "play" }</code> - Reproducir video</li>
          <li><code>{ "action": "pause" }</code> - Pausar video</li>
          <li><code>{ "action": "seek", "value": 10 }</code> - Avanzar 10 segundos</li>
          <li><code>{ "action": "seek", "value": -10 }</code> - Retroceder 10 segundos</li>
          <li><code>{ "action": "volume", "value": 0.1 }</code> - Aumentar volumen</li>
          <li><code>{ "action": "volume", "value": -0.1 }</code> - Disminuir volumen</li>
        </ul>
      </body>
      </html>
    `);
    return;
  }

  // Para cualquier otra solicitud HTTP
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

// Configurar servidor WebSocket
const wss = new WebSocketServer({ server });

// Contador de clientes conectados
let connectedClients = 0;

// Manejar conexiones WebSocket
wss.on("connection", (ws, req) => {
  connectedClients++;
  const clientIp = req.socket.remoteAddress;
  console.log(
    `Cliente conectado desde ${clientIp}. Total clientes: ${connectedClients}`
  );

  // Enviar mensaje de bienvenida al cliente
  ws.send(
    JSON.stringify({
      type: "system",
      message: "Conectado al servidor de control remoto de video",
    })
  );

  // Manejar mensajes recibidos
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Mensaje recibido: ${JSON.stringify(data)}`);

      // Validar formato del mensaje
      if (!data.action) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: 'Formato de mensaje inválido. Se requiere "action"',
          })
        );
        return;
      }

      // Reenviar mensaje a todos los clientes conectados
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });

      // Confirmar al remitente que el mensaje fue procesado
      ws.send(
        JSON.stringify({
          type: "ack",
          action: data.action,
          status: "delivered",
        })
      );
    } catch (err) {
      console.error("Error al procesar mensaje:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Error al procesar el mensaje",
        })
      );
    }
  });

  // Manejar cierre de conexión
  ws.on("close", () => {
    connectedClients--;
    console.log(`Cliente desconectado. Total clientes: ${connectedClients}`);
  });

  // Manejar errores
  ws.on("error", (error) => {
    console.error("Error en la conexión WebSocket:", error);
  });
});

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor WebSocket ejecutándose en puerto: ${PORT}`);
  console.log(`Para health check, visita: http://localhost:${PORT}/health`);
  console.log(`Para documentación, visita: http://localhost:${PORT}/`);
  console.log(`Permitiendo conexiones desde: ${ALLOWED_ORIGIN}`);
});
