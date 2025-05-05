// Video player functionality

// Initialize the video player with Video.js
function initializeVideoPlayer() {
  // Register custom TTS button component first
  registerTTSButtonComponent();

  // Check if the silvermine-videojs-quality-selector plugin is loaded
  try {
    if (typeof videojs.registerPlugin !== "undefined") {
      console.log("VideoJS plugin system is available");
    } else {
      console.error("VideoJS plugin system is not available");
    }
  } catch (error) {
    console.error("Error checking VideoJS plugin system:", error);
  }

  // Initialize Video.js player
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
        "TTSButton", // Add our custom TTS button to the control bar
        "subtitlesButton",
        "fullscreenToggle",
      ],
    },
    plugins: {
      qualitySelector: false,
    },
  });

  loadChaptersVTT();

  // Add the explanations track if it doesn't exist
  window.player.ready(function () {
    console.log("Video.js player is ready");

    // Set initial video source
    window.player.src({
      type: "video/mp4",
      src: config.video.url,
    });

    // Remove existing subtitle tracks
    const existingTracks = window.player.remoteTextTracks();
    const tracksToRemove = Array.from(existingTracks);
    tracksToRemove.forEach((track) => {
      window.player.removeRemoteTextTrack(track);
    });

    // Add subtitle tracks with correct sources
    const cityCapitalized =
      config.city.name.charAt(0).toUpperCase() + config.city.name.slice(1);

    // Add Spanish subtitles
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "es",
        label: "Español",
        src: `vtts/${config.city.name}/subtitulos${cityCapitalized}.vtt`,
        default: config.language.current === "es",
      },
      false
    );

    // Add English subtitles
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "en",
        label: "English",
        src: `vtts/${config.city.name}/subtitulos${cityCapitalized}_en.vtt`,
      },
      false
    );

    // Add Catalan subtitles
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "ca",
        label: "Català",
        src: `vtts/${config.city.name}/subtitulos${cityCapitalized}_ca.vtt`,
      },
      false
    );

    // Set up sources with different qualities for the plugin
    const sources = getSourcesForSelectorPlugin();
    console.log("Quality sources:", sources);

    // Set up initial source manually if needed
    let initialSource = sources.find((source) => source.selected);
    if (!initialSource) {
      initialSource = sources[0];
    }

    // Manually add sources for quality selection
    try {
      // Try to use the plugin
      if (window.player.controlBar.getChild("QualitySelector") === undefined) {
        // Use the plugin manually
        window.player.controlBar.addChild("QualitySelector", {});
      }
      window.player.updateSrc(sources);

      // Add quality change event listener manually
      window.player.on("qualityRequested", function (event, newSource) {
        console.log("Quality requested:", newSource.label);
        changeQuality(newSource.label.toLowerCase());
      });
    } catch (error) {
      console.error("Error setting up quality selector:", error);

      // Fallback: Create a manual dropdown for quality selection
      createManualQualityControl(sources);
    }

    // Add metadata track for explanations if it doesn't exist
    let hasExplanationTrack = false;
    const textTracks = window.player.textTracks();

    for (let i = 0; i < textTracks.length; i++) {
      if (
        textTracks[i].kind === "metadata" &&
        textTracks[i].label === "Explicaciones"
      ) {
        hasExplanationTrack = true;
        break;
      }
    }

    if (!hasExplanationTrack) {
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

    // Set initial subtitles language
    setSubtitles(config.language.current);

    // Load explanations
    loadVTTContent();
  });

  // Handle timeupdate event (equivalent to Plyr's timeupdate)
  window.player.on("timeupdate", function () {
    const currentTime = window.player.currentTime();
    if (config.segments.explanations.length > 0) {
      updateExplanation(currentTime);
    }
    updateMap(currentTime);
  });

  // Handle text track changes (for subtitles)
  window.player.on("texttrackchange", function () {
    const tracks = window.player.textTracks();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "subtitles" && track.mode === "showing") {
        console.log("Active subtitle track changed to:", track.language);

        // Update current language for TTS
        if (config.language.current !== track.language) {
          config.language.current = track.language;
          console.log(
            "Updated currentLanguage for TTS to:",
            config.language.current
          );

          // If TTS is enabled and there's active speech, restart it with the new language
          if (config.tts.enabled && config.tts.currentSpeech) {
            window.speechSynthesis.cancel();
            config.tts.currentSpeech = null;

            // If there are active cues, speak them with the new language
            if (track.activeCues && track.activeCues.length > 0) {
              const cueText = track.activeCues[0].text;
              speakSubtitle(cueText);
            }
          }
        }

        // Update the TTS button state if it exists
        const ttsButton = window.player.controlBar.getChild("TTSButton");
        if (ttsButton) {
          ttsButton.updateButtonState();
        }

        setExplanations(track.language);

        // Add cuechange handler for the active track
        track.removeEventListener("cuechange", handleSubtitleCueChange);
        track.addEventListener("cuechange", handleSubtitleCueChange);
        break;
      }
    }
  });

  // Function to handle subtitle cue changes for TTS
  function handleSubtitleCueChange(event) {
    if (config.tts.enabled && this.activeCues && this.activeCues.length > 0) {
      // Get the text of the active cue
      const cueText = this.activeCues[0].text;
      // Speak the subtitle text
      speakSubtitle(cueText);
    }
  }
}

// Function to create a manual quality selector as a fallback
function createManualQualityControl(sources) {
  // Quality control is handled by our custom HD button
  console.log("Using custom HD quality control");
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
