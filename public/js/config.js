// Configuration and global variables
const config = {
  video: {
    // DASH and HLS manifest URLs (se rellenan en initializeConfig)
    dashUrl: "",
    hlsUrl: "",

    title: "Tour en la ciudad",
  },

  audio: {
    currentQuality: "high", // default to high quality (320k)
  },

  // VTT files
  vtt: {
    explanations: "",
    subtitles: "",
    locations: "",
  },

  // Language and TTS settings
  language: {
    current: "es", // Default language
  },

  // TTS settings
  tts: {
    enabled: true,
    currentSpeech: null,
  },

  // Current city information
  city: {
    name: "",
    coordinates: {},
  },

  // Segment arrays
  segments: {
    explanations: [],
    locations: [],
  },

  // City coordinates
  cityCoordinates: {
    madrid: { lat: 40.4168, lng: -3.7038 },
    barcelona: { lat: 41.3851, lng: 2.1734 },
    valencia: { lat: 39.4699, lng: -0.3763 },
    palma: { lat: 39.5696, lng: 2.6502 },
  },

  // Map configuration
  map: {
    center: { lat: 40.4168, lng: -3.7038 }, // Default to Madrid
    zoom: 12,
    instance: null,
    markers: [],
  },
};

// Function to initialize configuration from URL params
function initializeConfig() {
  const params = new URLSearchParams(window.location.search);
  const city = (params.get("city") || "madrid").toLowerCase();
  config.city.name = city;
  config.video.currentQuality = params.get("quality") || "dash";
  const cityCap = city.charAt(0).toUpperCase() + city.slice(1);

  // Construye las URLs DASH y HLS usando el nombre de la ciudad
  const baseUrl = `https://gdie2504.ltim.uib.es/videos/${city}/out/`;
  config.video.dashUrl = `${baseUrl}manifest.mpd`;
  config.video.hlsUrl = `${baseUrl}manifest.m3u8`;


  // VTT y título
  config.vtt.explanations = `vtts/${city}/explicaciones${cityCap}.vtt`;
  config.vtt.subtitles = `vtts/${city}/subtitulos${cityCap}.vtt`;
  config.vtt.locations = `vtts/${city}/ubicaciones${cityCap}.vtt`;
  config.video.title = `Tour en ${cityCap}`;
  document.getElementById("cityName").textContent = config.video.title;

  if (config.cityCoordinates[city])
    config.map.center = config.cityCoordinates[city];

  // Redirige si falta quality
  if (!params.get("quality")) {
    const newURL = `${window.location.pathname}?city=${city}&quality=${config.video.currentQuality}`;
    window.location.replace(newURL);
  }
}

// Función para obtener las calidades de audio
function getAudioSources() {
  return [
    {
      label: "Alta Calidad (320kbps)",
      value: "high",
      selected: config.audio.currentQuality === "high",
    },
    {
      label: "Calidad Estándar (128kbps)",
      value: "standard",
      selected: config.audio.currentQuality === "standard",
    },
  ];
}

// Export configuration and functions
window.config = config;
window.initializeConfig = initializeConfig;
window.getAudioSources = getAudioSources;
