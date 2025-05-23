// Video player functionality

// Objeto global para almacenar las calidades disponibles en DASH
window.dashQualities = {
  available: false,
  resolutions: [],
};

// Initialize the video player with Video.js
function initializeVideoPlayer() {
  // Register custom TTS button component first
  registerTTSButtonComponent();

  // Check browser compatibility for streaming formats
  const hasHLSSupport = window.checkHLSSupport();
  const hasDASHSupport = window.checkDASHSupport();

  console.log(
    `Comprobando compatibilidad del navegador: HLS: ${hasHLSSupport}, DASH: ${hasDASHSupport}`
  );

  // Check if the streaming plugins are loaded
  try {
    // Check for HLS support
    if (typeof videojs.Html5Hlsjs !== "undefined") {
      console.log("HLS plugin is available");
    } else {
      console.warn(
        "HLS plugin is not available, but will try to use native HLS support if available"
      );
    }

    // Check for DASH support
    if (typeof videojs.Html5DashJS !== "undefined") {
      console.log("DASH plugin is available");
    } else {
      console.warn("DASH plugin is not available");
    }

    // Check if the quality selector plugin is loaded
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
    html5: {
      vhs: {
        overrideNative: true,
        limitRenditionByPlayerDimensions: false,
        useDevicePixelRatio: true,
      },
      nativeAudioTracks: false,
      nativeVideoTracks: false,
    },
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

    // Get sources with HLS and DASH options
    const sources = getSourcesForSelectorPlugin();
    console.log("Available sources:", sources);

    // Find selected source or default to first
    let initialSource = sources.find((source) => source.selected);
    if (!initialSource) {
      initialSource = sources[0]; // Default to first source (DASH)
    }

    console.log("Setting initial source:", initialSource);

    // Set initial video source
    window.player.src(initialSource);

    // Setup DASH functionality
    if (initialSource.type === "application/dash+xml") {
      window.player.one("dashInitialized", function () {
        console.log(
          "DASH initialized, setting up quality selection and audio track handling"
        );

        if (window.player.dash && window.player.dash.mediaPlayer) {
          const dashPlayer = window.player.dash.mediaPlayer;

          // Detect available video resolutions from DASH manifest
          window.player.on("loadedmetadata", function () {
            setTimeout(function () {
              try {
                // Get video tracks from DASH player
                const videoTracks = dashPlayer.getTracksFor("video");
                if (videoTracks && videoTracks.length > 0) {
                  console.log("Available DASH video tracks:", videoTracks);

                  // Extract resolutions and bitrates
                  const resolutions = videoTracks.map((track) => {
                    return {
                      id: track.id,
                      width: track.width,
                      height: track.height,
                      bitrate: track.bitrateValue,
                      label: `${track.width}x${track.height} (${Math.round(
                        track.bitrateValue / 1000
                      )} kbps)`,
                    };
                  });

                  // Sort by resolution (height) in descending order
                  resolutions.sort((a, b) => b.height - a.height);

                  // Set global variable for later use
                  window.dashQualities.available = true;
                  window.dashQualities.resolutions = resolutions;

                  // Add auto quality option at the top
                  resolutions.unshift({
                    id: "auto",
                    width: 0,
                    height: 0,
                    bitrate: 0,
                    label: "Auto (Adaptativo)",
                  });

                  console.log("DASH resolutions available:", resolutions);

                  // Update quality menu with these options
                  createDashQualityMenu(resolutions);
                }

                // Setup audio track selection based on config
                const audioTracks = dashPlayer.getTracksFor("audio");
                if (audioTracks && audioTracks.length > 0) {
                  console.log("Available DASH audio tracks:", audioTracks);

                  let targetTrack = null;
                  if (config.audio.currentQuality === "high") {
                    // Find track with highest bitrate
                    targetTrack = audioTracks.reduce((prev, current) =>
                      prev.bitrateValue > current.bitrateValue ? prev : current
                    );
                  } else {
                    // Find track with lowest bitrate
                    targetTrack = audioTracks.reduce((prev, current) =>
                      prev.bitrateValue < current.bitrateValue ? prev : current
                    );
                  }

                  if (targetTrack) {
                    console.log(
                      `Setting initial audio track to: ${targetTrack.id}, bitrate: ${targetTrack.bitrateValue}`
                    );
                    dashPlayer.setCurrentTrack(targetTrack);
                  }
                }
              } catch (e) {
                console.error("Error setting up DASH tracks:", e);
              }
            }, 1000); // Give DASH player a moment to load tracks
          });
        }
      });
    }

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
    console.log("Quality sources:", sources);

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

// Function to create a menu with DASH quality options
function createDashQualityMenu(resolutions) {
  console.log("Creating DASH quality menu with resolutions:", resolutions);

  // Find quality menu container
  const qualityMenu = document.querySelector(".vjs-quality-menu");
  if (!qualityMenu) {
    console.error("Cannot find quality menu to add DASH resolutions");
    return;
  }

  // Clear existing menu items
  qualityMenu.innerHTML = "";

  // Get the current player
  const player = videojs.getPlayer("videoPlayer");
  if (!player || !player.dash || !player.dash.mediaPlayer) {
    console.error("DASH player not available for quality selection");
    return;
  }

  const dashPlayer = player.dash.mediaPlayer;

  // Add items for each resolution
  resolutions.forEach((resolution) => {
    const menuItem = document.createElement("div");
    menuItem.className = "vjs-quality-menu-item";
    menuItem.textContent = resolution.label;
    menuItem.dataset.id = resolution.id;
    menuItem.dataset.height = resolution.height;

    // Handle click to change quality
    menuItem.addEventListener("click", function (e) {
      e.stopPropagation();

      // Update selected state in menu
      document.querySelectorAll(".vjs-quality-menu-item").forEach((item) => {
        item.classList.remove("selected");
      });
      this.classList.add("selected");

      try {
        if (resolution.id === "auto") {
          // Enable ABR (automatic bitrate adaptation)
          console.log("Setting DASH to auto quality (ABR)");
          dashPlayer.setAutoSwitchQualityFor("video", true);
        } else {
          // Disable ABR and force specific quality
          dashPlayer.setAutoSwitchQualityFor("video", false);

          // Find the quality index in the DASH player
          const videoTracks = dashPlayer.getTracksFor("video");
          const targetTrack = videoTracks.find(
            (track) => track.id === resolution.id
          );

          if (targetTrack) {
            const qualityIndex = videoTracks.indexOf(targetTrack);
            console.log(
              `Setting fixed DASH quality to ${resolution.label} (index: ${qualityIndex})`
            );
            dashPlayer.setQualityFor("video", qualityIndex);
          }
        }

        // Toggle menu visibility
        const menu = document.querySelector(".vjs-quality-menu");
        if (menu) menu.classList.remove("showing");
      } catch (error) {
        console.error("Error changing DASH quality:", error);
      }
    });

    // Set initially selected item
    if (
      (resolution.id === "auto" &&
        dashPlayer.getAutoSwitchQualityFor("video")) ||
      (resolution.id !== "auto" && !dashPlayer.getAutoSwitchQualityFor("video"))
    ) {
      menuItem.classList.add("selected");
    }

    qualityMenu.appendChild(menuItem);
  });

  // Add HLS option at the bottom
  const separator = document.createElement("div");
  separator.className = "vjs-quality-menu-separator";
  separator.style.borderTop = "1px solid rgba(255,255,255,0.2)";
  separator.style.margin = "5px 0";
  qualityMenu.appendChild(separator);

  const hlsItem = document.createElement("div");
  hlsItem.className = "vjs-quality-menu-item";
  hlsItem.textContent = "HLS Adaptativo";
  hlsItem.addEventListener("click", function (e) {
    e.stopPropagation();
    changeQuality("hls");
  });
  qualityMenu.appendChild(hlsItem);
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
window.createDashQualityMenu = createDashQualityMenu;

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
