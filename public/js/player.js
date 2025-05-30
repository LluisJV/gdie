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
    //plugins: {
    //  qualitySelector: false,
    //},
  });

  loadChaptersVTT();

  // Función para cambiar el formato
  function changeVideoFormat(format) {
    console.log('Cambiando a formato:', format.toUpperCase());
    
    // Pause current playback
    const wasPaused = window.player.paused();
    const currentTime = window.player.currentTime();
    
    // Cargar la nueva fuente
    loadVideoSource(format);
    
    // Restaurar el estado de reproducción
    window.player.one('loadedmetadata', function() {
      console.log('Fuente cargada, restaurando reproducción...');
      window.player.currentTime(currentTime);
      if (!wasPaused) {
        window.player.play().catch(e => console.error('Error al reanudar la reproducción:', e));
      }
    });
  }

  // Format selector functionality
  const formatSelector = document.getElementById('streamFormat');
  if (formatSelector) {
    formatSelector.addEventListener('change', function() {
      changeVideoFormat(this.value);
    });
  }

  // Función para cargar la fuente de video
  function loadVideoSource(format) {
    console.log('Cargando fuente:', format);
    
    let source;
    
    switch(format) {
      case 'dash':
        source = {
          src: config.video.dashUrl,
          type: 'application/dash+xml',
          keySystemOptions: [{
            name: 'com.widevine.alpha',
            options: { 'com.widevine.alpha': { persistentState: 'required' } }
          }]
        };
        break;
        
      case 'blockchain':
        source = {
          src: 'https://media.thetavideoapi.com/org_q9ej3ubwdj5hx8k5er8vufksb6jg/srvacc_azhbaxmcf2eeswt0ky23ifjmc/video_u3bvycgd7dtvbgdy9xzpwn0nk2/master.m3u8',
          type: 'application/x-mpegURL',
          withCredentials: false
        };
        break;
        
      case 'hls':
      default:
        source = {
          src: config.video.hlsUrl,
          type: 'application/x-mpegURL',
          withCredentials: false
        };
    }

    // Configuración del reproductor para streaming adaptativo
    const playerOptions = {
      html5: {
        vhs: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: !videojs.browser.IS_ANY_SAFARI,
          limitRenditionByPlayerDimensions: false
        }
      }
    };

    // Aplicar configuración al reproductor
    console.log('Configurando fuente de video...');
    console.log('URL:', format === 'dash' ? config.video.dashUrl : config.video.hlsUrl);
    
    // Cargar la fuente seleccionada
    window.player.src(source);
    
    // Configurar manejadores para rastrear la fuente
    window.player.one('loadstart', function() {
      console.log('Evento loadstart - Fuente actual:', window.player.currentSrc());
    });
    
    window.player.one('loadedmetadata', function() {
      console.log('Evento loadedmetadata');
      console.log('Tecnología de streaming:', window.player.tech_?.vhs?.sourceType_ || 'No disponible');
      console.log('URL de la fuente:', window.player.currentSrc());
      
      // Verificar si es DASH o HLS por la URL
      const src = window.player.currentSrc() || '';
      if (src.includes('.mpd')) {
        console.log('Tipo de fuente detectado: DASH');
      } else if (src.includes('.m3u8')) {
        console.log('Tipo de fuente detectado: HLS');
      } else {
        console.log('Tipo de fuente no reconocido');
      }
    });
  }

  // Inicializar el reproductor
  window.player.ready(function () {
    console.log("Video.js player is ready");
    
    // Obtener el formato seleccionado (DASH por defecto)
    const initialFormat = formatSelector ? formatSelector.value : 'dash';
    console.log('Formato inicial:', initialFormat);
    
    // Cargar la fuente inicial
    changeVideoFormat(initialFormat);
    
    // Configurar calidad automática por defecto
    window.player.tech_?.on('loadedmetadata', function() {
      console.log('Tecnología de streaming (tech):', window.player.tech_?.vhs?.sourceType_ || 'No disponible');
      console.log('Reproductor listo, URL actual:', window.player.currentSrc());
      
      if (window.player.tech_?.vhs) {
        const qualityLevels = window.player.qualityLevels();
        // Habilitar todas las calidades por defecto (modo automático)
        for (let i = 0; i < qualityLevels.length; i++) {
          qualityLevels[i].enabled = true;
        }
        
        // Guardar referencia a los qualityLevels para usarla más tarde
        window.videoQualityLevels = qualityLevels;
        
        // Establecer calidad automática por defecto si no hay una selección previa
        if (typeof window.videoQuality === 'undefined') {
          window.videoQuality = 'auto';
        }
        createQualityMenu(); // Llama a la función que acabas de mover aquí
        addTTSButtonNextToQuality(); // Llama a la función que acabas de mover aquí
      }
    });

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

    // 5) Configuración de calidad automática
    window.player.qualityLevels();
    
    // Opcional: Mostrar la calidad actual en consola cuando cambie
    window.player.tech_.on('ratechange', function() {
      const qualityLevels = window.player.qualityLevels();
      const currentLevel = qualityLevels[qualityLevels.selectedIndex];
      if (currentLevel) {
        console.log('Current quality:', currentLevel.height + 'p');
      }
    });

    // 6) Pista metadata para explicaciones
    const tracks = window.player.textTracks();
    let trackExists = false;
    
    // Verificar si ya existe la pista de explicaciones
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "metadata" && track.label === "Explicaciones") {
        trackExists = true;
        break;
      }
    }
    
    if (!trackExists) {
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
//window.createManualQualityControl = createManualQualityControl;
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


 function createQualityMenu() {
          const player = videojs.getPlayer("videoPlayer");
          if (!player) return;

          // Get available quality levels from the player
          const qualityLevels = player.qualityLevels ? Array.from(player.qualityLevels()) : [];
          
          // Create quality menu container
          const menuWrapper = document.createElement("div");
          menuWrapper.className = "vjs-quality-menu-wrapper";
          menuWrapper.id = "qualityMenuWrapper";

          // Create button
          const button = document.createElement("button");
          button.className = "vjs-quality-menu-button vjs-menu-button vjs-control";
          button.innerHTML = "";
          button.setAttribute("title", "Calidad de video");

          // Create menu
          const menu = document.createElement("div");
          menu.className = "vjs-quality-menu";

          // Add Auto option
          const autoItem = document.createElement("div");
          autoItem.className = "vjs-quality-menu-item";
          if (!window.videoQuality || window.videoQuality === 'auto') {
            autoItem.className += " selected";
          }
          autoItem.textContent = "Auto";
          autoItem.dataset.quality = "auto";
          autoItem.addEventListener("click", function(e) {
            e.stopPropagation();
            setQualityMode('auto');
            updateSelectedItem(this);
            toggleMenu(false);
          });
          menu.appendChild(autoItem);

          // Add separator
          const separator = document.createElement("div");
          separator.className = "vjs-menu-item vjs-menu-item-separator";
          separator.style.padding = '5px 0';
          separator.innerHTML = '<hr style="margin: 5px 10px; border-color: rgba(255,255,255,0.2)">';
          menu.appendChild(separator);

          // Add quality options
          const qualities = [
            { label: "4K", value: "4k", height: 2160 },
            { label: "1080p", value: "1080p", height: 1080 },
            { label: "720p", value: "720p", height: 720 },
            { label: "480p", value: "480p", height: 480 },
            { label: "360p", value: "360p", height: 360 },
            { label: "240p", value: "240p", height: 240 }
          ];

          // Filter available qualities based on what's in the manifest
          const availableQualities = qualities.filter(q => {
            return qualityLevels.some(level => level.height === q.height);
          });

          // If no quality levels detected, show default options
          const displayQualities = availableQualities.length > 0 ? availableQualities : qualities;

          // Add quality menu items
          displayQualities.forEach((quality) => {
            const menuItem = document.createElement("div");
            menuItem.className = "vjs-quality-menu-item";
            if (window.videoQuality === quality.value) {
              menuItem.className += " selected";
            }
            menuItem.textContent = quality.label;
            menuItem.dataset.quality = quality.value;
            menuItem.dataset.height = quality.height;
            menuItem.addEventListener("click", function(e) {
              e.stopPropagation();
              setQualityMode('manual', this.dataset.height);
              updateSelectedItem(this);
              toggleMenu(false);
            });
            menu.appendChild(menuItem);
          });

          // Function to update selected item
          function updateSelectedItem(selectedItem) {
            document.querySelectorAll('.vjs-quality-menu-item').forEach(item => {
              item.classList.remove('selected');
            });
            selectedItem.classList.add('selected');
          }

          // Function to set quality mode
          function setQualityMode(mode, height) {
            if (mode === 'auto') {
              // Enable all quality levels for auto selection
              qualityLevels.forEach(level => {
                level.enabled = true;
              });
              window.videoQuality = 'auto';
              button.setAttribute('title', 'Calidad: Auto');
            } else if (mode === 'manual' && height) {
              // Set specific quality level
              qualityLevels.forEach(level => {
                level.enabled = (level.height === parseInt(height));
              });
              window.videoQuality = Array.from(qualities).find(q => q.height === parseInt(height))?.value || '';
              button.setAttribute('title', `Calidad: ${window.videoQuality}`);
            }
          }

          // Toggle menu function
          function toggleMenu(show) {
            if (show === undefined) {
              menu.classList.toggle("showing");
            } else {
              menu.classList[show ? "add" : "remove"]("showing");
            }
          }

          // Toggle menu on button click
          button.addEventListener("click", function (e) {
            e.stopPropagation();
            toggleMenu();
          });

          // Hide menu when clicking outside
          document.addEventListener("click", function () {
            toggleMenu(false);
          });

          // Add elements to DOM
          menuWrapper.appendChild(button);
          menuWrapper.appendChild(menu);

          // Add to player control bar
          const fullscreenButton = player.controlBar
            .getChild("fullscreenToggle")
            .el();
          player.controlBar.el().insertBefore(menuWrapper, fullscreenButton);
        }
      // Function to add TTS button next to quality button
        function addTTSButtonNextToQuality() {
          const player = videojs.getPlayer("videoPlayer");
          if (!player || !player.controlBar) return;

          // Buscar el botón de calidad
          let qualityMenuWrapper = document.querySelector(
            ".vjs-quality-menu-wrapper"
          );

          // Si no existe, busca por id como fallback
          if (!qualityMenuWrapper) {
            qualityMenuWrapper = document.getElementById("qualityMenuWrapper");
          }

          // Comprobar si existe el botón TTS en la barra de controles
          let ttsButton = player.controlBar.getChild("TTSButton");

          // Si ya existe, lo eliminamos para reposicionarlo
          if (ttsButton) {
            player.controlBar.removeChild(ttsButton);
          }

          // Creamos un nuevo botón TTS
          ttsButton = player.controlBar.addChild("TTSButton", {});

          if (qualityMenuWrapper && ttsButton && ttsButton.el()) {
            // Insertar el botón TTS después del botón de calidad
            qualityMenuWrapper.parentNode.insertBefore(
              ttsButton.el(),
              qualityMenuWrapper.nextSibling
            );

            // Añadir clase para estilo especial cuando está junto al botón de calidad
            ttsButton.addClass("next-to-quality");

            // Asegurarnos de que tenga la posición correcta en el DOM
            ttsButton.el().id = "ttsButtonNextToQuality";
            ttsButton.el().style.position = "relative";
            ttsButton.el().style.display = "flex";
            ttsButton.el().style.alignItems = "center";
            ttsButton.el().style.justifyContent = "center";
            ttsButton.el().style.height = "3em";
            ttsButton.el().style.width = "4em";

            // Alinear verticalmente el icono y el texto TTS
            const iconPlaceholder = ttsButton
              .el()
              .querySelector(".vjs-icon-placeholder");
            if (iconPlaceholder) {
              iconPlaceholder.style.display = "flex";
              iconPlaceholder.style.alignItems = "center";
              iconPlaceholder.style.justifyContent = "center";
              iconPlaceholder.style.height = "100%";
              iconPlaceholder.style.marginTop = "0";
            }

            // Ajustar el SVG para que esté centrado
            const svg = ttsButton.el().querySelector("svg");
            if (svg) {
              svg.style.transform = "translateY(0)";
              svg.style.position = "relative";
              svg.style.top = "0";
            }

            // Forzar refresco visual del botón
            setTimeout(() => {
              ttsButton.el().style.opacity = "0.99";
              setTimeout(() => {
                ttsButton.el().style.opacity = "1";
              }, 50);
            }, 0);

            // Ajustar el título según el estado actual
            if (window.ttsEnabled) {
              ttsButton
                .el()
                .setAttribute(
                  "title",
                  "Desactivar lectura de subtítulos (TTS)"
                );
            } else {
              ttsButton
                .el()
                .setAttribute("title", "Activar lectura de subtítulos (TTS)");
            }

            console.log(
              "TTS button successfully positioned next to quality button"
            );
          } else {
            console.error(
              "Could not find quality button or TTS button to position"
            );
          }
        }
