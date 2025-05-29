// Video player functionality

// Iniciar el control remoto cuando se cargue la página
document.addEventListener("DOMContentLoaded", function () {
  initializeConfig();        // → rellena config.video.url (y redirige si falta ?quality)
  setupProtocolSwitcher();
  registerTTSButtonComponent();
  initializeVideoPlayer();   // → crea el player y hace player.src(config.video.url)
  loadVTTContent();
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
        selected:   this.player_.currentSource().type === srcObj.type
      });
      item.on('click', () => {
        // Solo cambia el protocolo, mantiene calidad en "auto"
        this.player_.src(srcObj);
        this.player_.play().catch(() => {});
      });
      return item;
    });
  }
}
console.log('ProtocolMenuButton:', videojs.getComponent('ProtocolMenuButton'));
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
      label: 'Blockchain',
      src:   'https://media.thetavideoapi.com/org_q9ej3ubwdj5hx8k5er8vufksb6jg/srvacc_azhbaxmcf2eeswt0ky23ifjmc/video_u3bvycgd7dtvbgdy9xzpwn0nk2/master.m3u8',
      type:  'application/x-mpegURL'
    });
  }
  console.log('videoSources:', sources); // Para depurar
  window.videoSources = sources;
}

// 3) Inicializa el player con el botón “Fuente” y las fuentes
function initializeVideoPlayer(initialProtocol) {
  buildVideoSources();

  if (window.player && window.player.dispose) {
    window.player.dispose();
  }

  window.player = videojs('videoPlayer', {
    controls: true,
    preload: 'auto',
    html5: { vhs: { enableLowInitialPlaylist: true } },
    sources: window.videoSources,
    controlBar: {
      children: [
        'playToggle',
        'volumePanel',
        'progressControl',
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'SubsCapsButton',
        'httpSourceSelector', // SOLO este para calidad
        'TTSButton',
        'fullscreenToggle'
      ]
    },
    plugins: {
      httpSourceSelector: {
        default: initialProtocol || config.video.currentQuality,
        dynamicLabel: true,
        vhs: true
      }
    }
  });

  window.player.ready(() => {
    if (typeof window.player.httpSourceSelector === 'function') {
      window.player.httpSourceSelector();
    }

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
      }
    });

function setupProtocolSwitcher() {
  const switcher = document.getElementById('protocolSwitcher');
  if (!switcher) return;

  // 1) Oculta "Blockchain" si no es Madrid
  if (config.city.name.toLowerCase() !== 'madrid') {
    const opt = switcher.querySelector('option[value="blockchain"]');
    if (opt) opt.remove();
  }

  // 2) Maneja la selección
  switcher.addEventListener('change', (e) => {
    const proto = e.target.value;
    initializeVideoPlayer(proto);
  });

  // 3) Marca por defecto el protocolo actual
  switcher.value = initialProtocol || config.video.currentQuality || 'dash';
}


// Cambiar calidad de video (DASH/HLS)
function changeQuality(label) {
  const isHls = label === 'hls';
  window.player.src({
    src: `https://gdie2504.ltim.uib.es/videos/${config.city.name}/out/manifest.${isHls ? 'm3u8' : 'mpd'}`,
    type: isHls ? 'application/x-mpegURL' : 'application/dash+xml'
  });
  window.player.play().catch(() => {});

  // Refresca el menú si está abierto
  const menu = document.querySelector('.vjs-quality-menu.showing');
  if (menu) {
    if (isHls) createHlsQualityMenu();
    else       createDashQualityMenu(getDashResolutions());
  }
}

// Menú de calidad para DASH
function createDashQualityMenu(resolutions) {
  const qualityMenu = document.querySelector(".vjs-quality-menu");
  if (!qualityMenu) return;

  qualityMenu.innerHTML = "";

  // Encabezado DASH
  const dashHeader = document.createElement("div");
  dashHeader.className = "vjs-quality-menu-header";
  dashHeader.textContent = "DASH (Adaptativo)";
  dashHeader.style.fontWeight = "bold";
  dashHeader.style.padding = "6px 12px";
  qualityMenu.appendChild(dashHeader);

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

    qualityMenu.appendChild(menuItem);
  });

  // Separador
  const separator = document.createElement("div");
  separator.className = "vjs-quality-menu-separator";
  separator.style.borderTop = "1px solid rgba(255,255,255,0.2)";
  separator.style.margin = "5px 0";
  qualityMenu.appendChild(separator);

  // Botón para cambiar a HLS
  const hlsItem = document.createElement("div");
  hlsItem.className = "vjs-quality-menu-item";
  hlsItem.textContent = "Cambiar a HLS";
  hlsItem.style.fontWeight = "bold";
  hlsItem.addEventListener("click", function (e) {
    e.stopPropagation();
    changeQuality("hls");
  });
  qualityMenu.appendChild(hlsItem);
}

function createHlsQualityMenu() {
  const qualityMenu = document.querySelector(".vjs-quality-menu");
  if (!qualityMenu) return;

  qualityMenu.innerHTML = "";

  // Encabezado HLS
  const hlsHeader = document.createElement("div");
  hlsHeader.className = "vjs-quality-menu-header";
  hlsHeader.textContent = "HLS (Adaptativo)";
  hlsHeader.style.fontWeight = "bold";
  hlsHeader.style.padding = "6px 12px";
  qualityMenu.appendChild(hlsHeader);

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

  // Separador
  const separator = document.createElement("div");
  separator.className = "vjs-quality-menu-separator";
  separator.style.borderTop = "1px solid rgba(255,255,255,0.2)";
  separator.style.margin = "5px 0";
  qualityMenu.appendChild(separator);

  // Botón para cambiar a DASH
  const dashItem = document.createElement("div");
  dashItem.className = "vjs-quality-menu-item";
  dashItem.textContent = "Cambiar a DASH";
  dashItem.style.fontWeight = "bold";
  dashItem.addEventListener("click", function (e) {
    e.stopPropagation();
    changeQuality("dash");
  });
  qualityMenu.appendChild(dashItem);
}

// Añade esta función para obtener las resoluciones DASH
function getDashResolutions() {
  const player = videojs.getPlayer('videoPlayer');
  if (!player || !player.dash || !player.dash.mediaPlayer) return [];
  const dashPlayer = player.dash.mediaPlayer;
  const videoTracks = dashPlayer.getTracksFor('video');
  const list = [];
  list.push({ label: 'Auto (Adaptativo)', id: 'auto' });
  videoTracks.forEach(track => {
    list.push({
      label: track.height ? `${track.height}p` : `${Math.round(track.bitrate/1000)} kbps`,
      id: track.id
    });
  });
  return list;
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

// Quality menu button component
const Button = videojs.getComponent('Button');

class QualityMenuButton extends Button {
  constructor(player, options) {
    super(player, options);
    this.controlText('Calidad');
    this.addClass('vjs-quality-button');
    this.on('click', this.showQualityMenu);
  }

  showQualityMenu() {
    const srcType = this.player().currentSource().type;
    if (srcType === 'application/dash+xml') {
      createDashQualityMenu(getDashResolutions());
    } else {
      createHlsQualityMenu();
    }
    const menu = document.querySelector('.vjs-quality-menu');
    if (menu) menu.classList.add('showing');
  }
}
videojs.registerComponent('QualityMenuButton', QualityMenuButton);

// ...antes de initializeVideoPlayer, registra todos los componentes personalizados:
videojs.registerComponent('SubsCapsButton', videojs.getComponent('SubsCapsButton'));
videojs.registerComponent('ProtocolMenuButton', ProtocolMenuButton);
registerTTSButtonComponent(); // Si tu función ya lo hace, no repitas

// ...en tu función initializeVideoPlayer:
function initializeVideoPlayer() {
  buildVideoSources();

  window.player = videojs('videoPlayer', {
    controls: true,
    preload: 'auto',
    html5: { vhs: { enableLowInitialPlaylist: true } },
    controlBar: {
      // ¡Incluye aquí TODOS los botones que quieres que persistan!
      children: [
        'playToggle',
        'volumePanel',
        'progressControl',
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'SubsCapsButton',      // Botón de subtítulos nativo
        // 'ProtocolMenuButton', // Si usas el externo, puedes quitarlo
        'HttpSourceSelector',  // Botón de calidad oficial (plugin)
        'TTSButton',           // Tu botón TTS
        'fullscreenToggle'
      ]
    },
    plugins: {
      httpSourceSelector: {
        default: 'auto',
        dynamicLabel: true,
        vhs: true
      }
    }
  });

  window.player.src(window.videoSources);

  // Ya NO necesitas reinyectar botones en techreset/sourcechanged
  // Mantén solo la recarga de pistas/subtítulos:
  window.player.ready(() => {
    if (typeof window.player.httpSourceSelector === 'function') {
      window.player.httpSourceSelector();
    }

    // 1) Cargar pistas metadata y subtítulos
    loadAllTextTracks();

    // 2) Renderizar capítulos (ahora sí, ya existen las cues)
    loadVTTContent();

    // 3) Actualizar mapa en cada avance del vídeo
    window.player.on('timeupdate', () => {
      updateMap(window.player.currentTime());
    });

    // 4) Inicializar control remoto y switcher de protocolo
    setupRemoteControl();
    setupProtocolSwitcher();
  });

  setupProtocolSwitcher();
}

// Estilos CSS para el menú de calidad
const style = document.createElement('style');
style.textContent = `
.vjs-quality-menu {
  position: absolute;
  bottom: 100%;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 4px;
  display: none;
  z-index: 1000;
}
.vjs-quality-menu.showing {
  display: block;
}
`;
document.head.appendChild(style);

// Quality switcher setup
function setupQualitySwitcher() {
  const switcher = document.getElementById('qualitySwitcher');
  if (!switcher) return;

  // Limpia el switcher
  switcher.innerHTML = '';

  // Detecta protocolo actual
  const isDash = window.player.currentSource().type === 'application/dash+xml';
  let qualities = [];

  if (isDash && window.player.dash && window.player.dash.mediaPlayer) {
    // DASH: usa getDashResolutions()
    qualities = getDashResolutions().filter(q => q.id !== 'auto');
    // Añade opción Auto
    qualities.unshift({ label: 'Auto', id: 'auto' });
  } else if (window.player.qualityLevels) {
    // HLS: usa qualityLevels()
    const levels = window.player.qualityLevels();
    qualities = [{ label: 'Auto', id: 'auto' }];
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].height) {
        qualities.push({ label: `${levels[i].height}p`, id: levels[i].height });
      }
    }
  }

  // Crea los botones
  qualities.forEach(q => {
    const btn = document.createElement('button');
    btn.textContent = q.label;
    btn.setAttribute('data-quality', q.id);
    switcher.appendChild(btn);
  });

  // Marca activo el primero por defecto
  if (switcher.firstChild) switcher.firstChild.classList.add('active');

  // Añade manejadores
  switcher.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      switcher.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const q = btn.getAttribute('data-quality');
      if (q === 'auto') {
        if (isDash && window.player.dash) {
          window.player.dash.mediaPlayer.setAutoSwitchQualityFor('video', true);
        } else if (window.player.qualityLevels) {
          window.player.qualityLevels().forEach(l => l.enabled = true);
        }
      } else {
        if (isDash && window.player.dash) {
          window.player.dash.mediaPlayer.setAutoSwitchQualityFor('video', false);
          const tracks = window.player.dash.mediaPlayer.getTracksFor('video');
          const track = tracks.find(t => t.height == parseInt(q,10));
          if (track) {
            const idx = tracks.indexOf(track);
            window.player.dash.mediaPlayer.setQualityFor('video', idx);
          }
        } else if (window.player.qualityLevels) {
          const levels = window.player.qualityLevels();
          levels.forEach((l, i) => l.enabled = (l.height == parseInt(q,10)));
        }
      }
    });
  });
}

function buildQualitySwitcherButtons() {
  const container = document.getElementById('qualitySwitcher');
  if (!container) return;
  container.innerHTML = '';

  let items = [];
  // DASH
  if (window.player.dash && window.player.dash.mediaPlayer) {
    items = getDashResolutions();
  }
  // HLS
  else if (window.player.qualityLevels) {
    const levels = window.player.qualityLevels();
    items = [{ label: 'Auto', id: 'auto' }]
      .concat(
        Array.from(levels).map(l => ({
          label:  l.height ? `${l.height}p` : `${Math.round(l.bitrate/1000)}kbps`,
          id:     l.height || l.bitrate
        }))
      );
  }

  items.forEach(({ label, id }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.quality = id;
    container.appendChild(btn);
  });

  setupQualitySwitcherListeners();
}

function setupQualitySwitcherListeners() {
  const switcher = document.getElementById('qualitySwitcher');
  if (!switcher) return;
  switcher.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      switcher.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const q = btn.dataset.quality;
      // Auto
      if (q === 'auto') {
        if (window.player.dash && window.player.dash.mediaPlayer) {
          window.player.dash.mediaPlayer.setAutoSwitchQualityFor('video', true);
        } else if (window.player.qualityLevels) {
          window.player.qualityLevels().forEach(l => l.enabled = true);
        }
      }
      // Manual
      else {
        if (window.player.dash && window.player.dash.mediaPlayer) {
          const mp = window.player.dash.mediaPlayer;
          mp.setAutoSwitchQualityFor('video', false);
          const track = mp.getTracksFor('video').find(t => String(t.height || t.bitrate) === q);
          if (track) mp.setQualityFor('video', mp.getTracksFor('video').indexOf(track));
        } else if (window.player.qualityLevels) {
          window.player.qualityLevels().forEach(l => {
            l.enabled = String(l.height || l.bitrate) === q;
          });
        }
      }
    };
  });
}

