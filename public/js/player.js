// Video player functionality

// Initialize the video player with Video.js
function initializeVideoPlayer() {
  // 1) Registro botón TTS
  registerTTSButtonComponent();

  // 2) Inicialización Video.js
  window.player = videojs("videoPlayer", {
    controls: true,
    autoplay: false,
    preload: "auto",
    fluid: true,
    playbackRates: [0.5, 1, 1.5, 2],
    controlBar: {
      children: [
        "playToggle",
        "volumePanel",
        "progressControl",
        "currentTimeDisplay",
        "timeDivider",
        "durationDisplay",
        "TTSButton",
        "subtitlesButton",
        "fullscreenToggle",
      ],
    },
    plugins: {
      qualitySelector: false,
    },
  });

  loadChaptersVTT();

  window.player.ready(function () {
    console.log("Video.js player is ready");

    // 3) Streaming adaptativo: DASH con fallback a HLS
    const adaptiveSources = [
      { src: config.video.dashUrl, type: "application/dash+xml" },
      { src: config.video.hlsUrl, type: "application/x-mpegURL" },
    ];
    window.player.src(adaptiveSources);

    // 4) TextTracks (subtítulos)
    const existing = window.player.remoteTextTracks();
    Array.from(existing).forEach((t) => window.player.removeRemoteTextTrack(t));

    const cityCap =
      config.city.name.charAt(0).toUpperCase() + config.city.name.slice(1);
    // Español
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "es",
        label: "Español",
        src: `vtts/${config.city.name}/subtitulos${cityCap}.vtt`,
        default: config.language.current === "es",
      },
      false
    );
    // Inglés
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "en",
        label: "English",
        src: `vtts/${config.city.name}/subtitulos${cityCap}_en.vtt`,
      },
      false
    );
    // Català
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "ca",
        label: "Català",
        src: `vtts/${config.city.name}/subtitulos${cityCap}_ca.vtt`,
      },
      false
    );

    // 5) Selector de calidad (tu código existente)
    const sources = getSourcesForSelectorPlugin();
    let initial = sources.find((s) => s.selected) || sources[0];
    try {
      if (!window.player.controlBar.getChild("QualitySelector")) {
        window.player.controlBar.addChild("QualitySelector", {});
      }
      window.player.updateSrc(sources);
      window.player.on("qualityRequested", (e, newS) => {
        changeQuality(newS.label.toLowerCase());
      });
    } catch (err) {
      console.error("Error quality selector:", err);
      createManualQualityControl(sources);
    }

    // 6) Pista metadata para explicaciones
    const tracks = window.player.textTracks();
    if (
      ![...tracks].some(
        (t) => t.kind === "metadata" && t.label === "Explicaciones"
      )
    ) {
      window.player.addRemoteTextTrack(
        {
          kind: "metadata",
          src: config.vtt.explanations,
          label: "Explicaciones",
          default: true,
        },
        false
      );
    }

    setSubtitles(config.language.current);
    loadVTTContent();
  });

  // 7) Eventos timeupdate y cambio de pista
  window.player.on("timeupdate", () => {
    const t = window.player.currentTime();
    if (config.segments.explanations.length) updateExplanation(t);
    updateMap(t);
  });

  window.player.on("texttrackchange", () => {
    const tracks = window.player.textTracks();
    for (let i = 0; i < tracks.length; i++) {
      const tr = tracks[i];
      if (tr.kind === "subtitles" && tr.mode === "showing") {
        config.language.current = tr.language;
        const ttsB = window.player.controlBar.getChild("TTSButton");
        if (ttsB) ttsB.updateButtonState();
        setExplanations(tr.language);
        tr.removeEventListener("cuechange", handleSubtitleCueChange);
        tr.addEventListener("cuechange", handleSubtitleCueChange);
        break;
      }
    }
  });

  function handleSubtitleCueChange() {
    if (config.tts.enabled && this.activeCues.length) {
      speakSubtitle(this.activeCues[0].text);
    }
  }
}

// Export player functions
window.initializeVideoPlayer = initializeVideoPlayer;
window.createManualQualityControl = createManualQualityControl;
window.setupRemoteControl = setupRemoteControl;

// Implementación del WebSocket para control remoto
function setupRemoteControl() {
  const wsServerUrl = getWebSocketUrl();
  let socket;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;
  let roomCode = null;

  function getWebSocketUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}`;
    console.log("WebSocket URL:", url);
    return url;
  }

  function connectWebSocket() {
    console.log("Intentando conectar a WebSocket:", wsServerUrl);

    try {
      socket = new WebSocket(wsServerUrl);

      socket.onopen = () => {
        console.log("✅ Conexión WebSocket establecida");
        // Registrar el cliente como una página de video
        const registerMessage = {
          type: "register",
          client: "video",
        };
        console.log("Enviando mensaje de registro:", registerMessage);
        socket.send(JSON.stringify(registerMessage));
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 Mensaje recibido:", data);

          // Manejar mensaje de asignación de sala
          if (data.type === "room") {
            roomCode = data.roomCode;
            console.log("🎯 Código de sala asignado:", roomCode);

            // Mostrar el código en la interfaz
            displayRoomCode(roomCode);
          }
          // Comprobar todos los tipos de mensajes posibles
          else if (data.type === "command") {
            console.log("🎮 Procesando comando:", data.action, data.value);
            handleRemoteCommand(data);
          } else if (data.type === "system") {
            console.log("ℹ️ Mensaje del sistema:", data.message);
          } else if (data.type === "ack") {
            console.log("✅ Confirmación recibida:", data);
          } else {
            console.log("❓ Mensaje desconocido:", data);
          }
        } catch (err) {
          console.error("❌ Error al procesar mensaje:", err);
          console.error("Datos recibidos:", event.data);
        }
      };

      socket.onclose = (event) => {
        console.log("🔌 WebSocket cerrado:", event.code, event.reason);

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(
            `🔄 Reconectando (intento ${reconnectAttempts}/${maxReconnectAttempts})...`
          );
          setTimeout(connectWebSocket, reconnectDelay);
        } else {
          console.error("❌ Máximo número de intentos de reconexión alcanzado");
        }
      };

      socket.onerror = (error) => {
        console.error("❌ Error en WebSocket:", error);
      };
    } catch (error) {
      console.error("❌ Error al crear WebSocket:", error);
    }
  }

  // Función para mostrar el código de sala en la interfaz
  function displayRoomCode(code) {
    console.log("Intentando mostrar código de sala:", code);
    const roomCodeElement = document.getElementById("roomCode");
    const roomCodeContainer = document.getElementById("roomCodeContainer");

    if (roomCodeElement && roomCodeContainer) {
      console.log("Elementos del DOM encontrados, actualizando código...");
      roomCodeElement.textContent = code;
      roomCodeContainer.style.display = "flex";

      // Efecto visual para llamar la atención sobre el código
      roomCodeContainer.style.transform = "scale(1.1)";
      setTimeout(() => {
        roomCodeContainer.style.transform = "scale(1)";
      }, 300);
    } else {
      console.error(
        "❌ No se encontraron los elementos del DOM para mostrar el código"
      );
      if (!roomCodeElement) console.error("Elemento 'roomCode' no encontrado");
      if (!roomCodeContainer)
        console.error("Elemento 'roomCodeContainer' no encontrado");
    }
  }

  function handleRemoteCommand(data) {
    if (!window.player) {
      console.error("El reproductor de video no está inicializado");
      return;
    }

    try {
      console.log(`Ejecutando acción '${data.action}' con valor:`, data.value);

      switch (data.action) {
        case "play":
          console.log("Intentando reproducir el video...");
          const playPromise = window.player.play();

          if (playPromise !== undefined) {
            playPromise
              .then((_) => {
                console.log("Reproducción iniciada con éxito");
              })
              .catch((error) => {
                console.error("Error al iniciar reproducción:", error);
              });
          }
          break;

        case "pause":
          console.log("Intentando pausar el video...");
          window.player.pause();
          console.log("Video pausado");
          break;

        case "seek":
          const currentTime = window.player.currentTime();
          const newTime = currentTime + data.value;
          console.log(`Desplazando de ${currentTime}s a ${newTime}s`);
          window.player.currentTime(newTime >= 0 ? newTime : 0);
          break;

        case "volume":
          const currentVolume = window.player.volume();
          const newVolume = Math.min(
            Math.max(currentVolume + data.value, 0),
            1
          );
          console.log(`Ajustando volumen de ${currentVolume} a ${newVolume}`);
          window.player.volume(newVolume);
          break;

        default:
          console.warn("Comando de control remoto desconocido:", data.action);
      }
    } catch (error) {
      console.error(`Error al ejecutar comando ${data.action}:`, error);
    }
  }

  // Iniciar la conexión WebSocket
  connectWebSocket();
}

// Iniciar el control remoto cuando se cargue la página
document.addEventListener("DOMContentLoaded", function () {
  // Call setupRemoteControl immediately instead of with a timeout
  setupRemoteControl();
});
