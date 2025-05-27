// Video player functionality

// Iniciar el control remoto cuando se cargue la página
document.addEventListener("DOMContentLoaded", function () {
  initializeConfig();        // → rellena config.video.url (y redirige si falta ?quality)
  initializeVideoPlayer();   // → crea el player y hace player.src(config.video.url)
  setupRemoteControl();      // → WS, ya con player inicializado
});

// 1) Registrar el botón de Fuente (sólo una vez, antes de crear el player)
const MenuButton = videojs.getComponent('MenuButton');
const MenuItem   = videojs.getComponent('MenuItem');

class ProtocolMenuButton extends MenuButton {
  constructor(player, options) {
    super(player, options);
    this.controlText('Fuente');
  }
  buildCSSClass() {
    return `vjs-menu-button vjs-menu-button-popup vjs-icon-hd ${super.buildCSSClass()}`;
  }
  createItems() {
    return (window.videoSources || []).map(srcObj => {
      const item = new MenuItem(this.player_, {
        label:      srcObj.label,
        selectable: true,
        selected:   false
      });
      item.on('click', () => {
        this.player_.src(srcObj);
        this.player_.play().catch(() => {});
      });
      return item;
    });
  }
}
videojs.registerComponent('ProtocolMenuButton', ProtocolMenuButton);

// 2) Construye videoSources dinámicamente según la ciudad
function buildVideoSources() {
  const city = config.city.name.toLowerCase();
  const base = `https://gdie2504.ltim.uib.es/videos/${city}/out/manifest`;
  const sources = [
    { label: 'DASH Adaptativo', src: `${base}.mpd`,   type: 'application/dash+xml' },
    { label: 'HLS Adaptativo',  src: `${base}.m3u8`, type: 'application/x-mpegURL' }
  ];
  if (city === 'madrid') {
    sources.push({
      label: 'Blockchain HLS',
      src:   'https://media.thetavideoapi.com/org_q9ej3ubwdj5hx8k5er8vufksb6jg/srvacc_azhbaxmcf2eeswt0ky23ifjmc/video_u3bvycgd7dtvbgdy9xzpwn0nk2/master.m3u8',
      type:  'application/x-mpegURL'
    });
  }
  console.log('videoSources:', sources); // Para depurar
  window.videoSources = sources;
}

// 3) Inicializa el player con el botón “Fuente” y las fuentes
function initializeVideoPlayer() {
  registerTTSButtonComponent();
  buildVideoSources();   // recalcula videoSources según la ciudad

  window.player = videojs('videoPlayer', {
    controls: true,
    preload:  'auto',
    html5:    { vhs: { enableLowInitialPlaylist: true } },
    controlBar: {
      children: [
        'playToggle',
        'volumePanel',
        'progressControl',
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'ProtocolMenuButton',  // menú de Fuente
        'fullscreenToggle'
      ]
    }
  });

  // Cargamos las fuentes en VHS
  window.player.src(window.videoSources);

  // Un único ready para el resto de tu setup (subtítulos/VTT/etc.)
  window.player.ready(() => {
    // Carga inicial de pistas
    loadAllTextTracks();

    // Cada vez que cambias de fuente (DASH/HLS), recarga pistas
    window.player.on('loadedmetadata', () => {
      // Limpia pistas viejas
      window.player.remoteTextTracks().forEach(t => window.player.removeRemoteTextTrack(t));
      // Recarga todas
      loadAllTextTracks();
    });
  });
}

// Cambiar calidad de video (DASH/HLS)
function changeQuality(label) {
  const isHls = label === "hls";
  window.player.src({
    src: `https://gdie2504.ltim.uib.es/videos/${config.city.name}/out/manifest.${isHls?"m3u8":"mpd"}`,
    type: isHls
      ? "application/x-mpegURL"
      : "application/dash+xml"
  });
  // Forzamos play tras cambiar de fuente
  window.player.play().catch(() => {});
}

// Menú de calidad para DASH
function createDashQualityMenu(resolutions) {
  const qualityMenu = document.querySelector(".vjs-quality-menu");
  if (!qualityMenu) return;

  qualityMenu.innerHTML = "";

  const player = videojs.getPlayer("videoPlayer");
  if (!player || !player.dash || !player.dash.mediaPlayer) return;
  const dashPlayer = player.dash.mediaPlayer;

  resolutions.forEach((resolution) => {
    const menuItem = document.createElement("div");
    menuItem.className = "vjs-quality-menu-item";
    menuItem.textContent = resolution.label;
    menuItem.dataset.id = resolution.id;

    menuItem.addEventListener("click", function (e) {
      e.stopPropagation();
      document.querySelectorAll(".vjs-quality-menu-item").forEach((item) => item.classList.remove("selected"));
      this.classList.add("selected");

      try {
        if (resolution.id === "auto") {
          dashPlayer.setAutoSwitchQualityFor("video", true);
        } else {
          dashPlayer.setAutoSwitchQualityFor("video", false);
          const videoTracks = dashPlayer.getTracksFor("video");
          const targetTrack = videoTracks.find((track) => track.id === resolution.id);
          if (targetTrack) {
            const qualityIndex = videoTracks.indexOf(targetTrack);
            dashPlayer.setQualityFor("video", qualityIndex);
          }
        }
        const menu = document.querySelector(".vjs-quality-menu");
        if (menu) menu.classList.remove("showing");
      } catch (error) {
        console.error("Error changing DASH quality:", error);
      }
    });

    // Set initially selected item
    if (
      (resolution.id === "auto" && dashPlayer.getAutoSwitchQualityFor("video")) ||
      (resolution.id !== "auto" && !dashPlayer.getAutoSwitchQualityFor("video"))
    ) {
      menuItem.classList.add("selected");
    }

    qualityMenu.appendChild(menuItem);
  });

  // Opción para cambiar a HLS
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

// Menú de calidad para HLS
function createHlsQualityMenu() {
  const qualityMenu = document.querySelector(".vjs-quality-menu");
  if (!qualityMenu) return;

  qualityMenu.innerHTML = "";

  const levels = window.player.qualityLevels();
  if (!levels || levels.length === 0) return;

  // Opción Auto
  const autoItem = document.createElement("div");
  autoItem.className = "vjs-quality-menu-item";
  autoItem.textContent = "Auto (Adaptativo)";
  autoItem.addEventListener("click", function () {
    for (let i = 0; i < levels.length; i++) levels[i].enabled = true;
    document.querySelectorAll(".vjs-quality-menu-item").forEach((item) => item.classList.remove("selected"));
    this.classList.add("selected");
  });
  qualityMenu.appendChild(autoItem);

  // Opciones manuales
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const item = document.createElement("div");
    item.className = "vjs-quality-menu-item";
    item.textContent = level.height ? `${level.height}p` : `${Math.round(level.bitrate/1000)}kbps`;
    item.addEventListener("click", function () {
      for (let j = 0; j < levels.length; j++) levels[j].enabled = (j === i);
      document.querySelectorAll(".vjs-quality-menu-item").forEach((item) => item.classList.remove("selected"));
      this.classList.add("selected");
    });
    qualityMenu.appendChild(item);
  }

  // Opción para cambiar a DASH
  const separator = document.createElement("div");
  separator.className = "vjs-quality-menu-separator";
  separator.style.borderTop = "1px solid rgba(255,255,255,0.2)";
  separator.style.margin = "5px 0";
  qualityMenu.appendChild(separator);

  const dashItem = document.createElement("div");
  dashItem.className = "vjs-quality-menu-item";
  dashItem.textContent = "DASH Adaptativo";
  dashItem.addEventListener("click", function (e) {
    e.stopPropagation();
    changeQuality("dash");
  });
  qualityMenu.appendChild(dashItem);
}

// Exporta las funciones si las necesitas fuera
window.changeQuality = changeQuality;
window.createDashQualityMenu = createDashQualityMenu;
window.createHlsQualityMenu = createHlsQualityMenu;

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

// ...después de tu función initializeVideoPlayer() añade:
function loadAllTextTracks() {
  const player = window.player;

  // 1) Explicaciones (metadata)
  const expTrackEl = player.addRemoteTextTrack({
    kind:    'metadata',
    label:   'Explicaciones',
    src:     config.vtt.explanations,
    default: false
  }, false).track;
  expTrackEl.mode = 'hidden';
  expTrackEl.addEventListener('load', () => {
    config.segments.explanations = Array.from(expTrackEl.cues).map(cue => ({
      start: cue.startTime, end: cue.endTime, text: cue.text
    }));
    // mostrar la explicación actual inmediatamente
    const now = player.currentTime();
    const active = config.segments.explanations.find(s => now >= s.start && now < s.end);
    document.getElementById('transcriptText').textContent = active ? active.text : 'Avanza el vídeo para ver las explicaciones';
  });
  expTrackEl.addEventListener('cuechange', () => {
    const cues = Array.from(expTrackEl.activeCues);
    document.getElementById('transcriptText').textContent = cues.length ? cues[0].text : '';
  });

  // 2) Ubicaciones (metadata)
  const locTrackEl = player.addRemoteTextTrack({
    kind:  'metadata',
    label: 'Ubicaciones',
    src:   config.vtt.locations
  }, false).track;
  locTrackEl.mode = 'hidden';
  locTrackEl.addEventListener('load', () => {
    config.segments.locations = Array.from(locTrackEl.cues).map(cue => {
      const d = JSON.parse(cue.text);
      return {
        start:       cue.startTime,
        end:         cue.endTime,
        coordinates: { lat: d.lat, lng: d.lng },
        name:        d.name
      };
    });
    // forzar primer pintado
    updateMap(player.currentTime());
  });

  // 3) Subtítulos (por cada idioma)
  ['es','en','ca'].forEach(lang => {
    const cityCap = config.city.name[0].toUpperCase() + config.city.name.slice(1);
    player.addRemoteTextTrack({
      kind:    'subtitles',
      srclang: lang,
      label:   lang==='es'?'Español': lang==='en'?'English':'Català',
      src:     `vtts/${config.city.name}/subtitulos${cityCap}${lang==='es'?'':('_'+lang)}.vtt`,
      default: config.language.current === lang
    }, false).track.addEventListener('cuechange', () => {
      // aquí tu TTS o lo que necesites
    });
  });
}

