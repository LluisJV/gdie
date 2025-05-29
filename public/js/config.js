// js/config.js

// Configuration and global variables
const config = {
  // Video related variables
  video: {
    // DASH and HLS manifest URLs (se rellenan en initializeConfig)
    dashUrl: "",
    hlsUrl: "",
    title: "Tour en la ciudad",
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
  // Ciudad en minúsculas, p.ej. "barcelona"
  const city = (params.get("city") || "madrid").toLowerCase();

  // Store the current city
  config.city.name = city;

  // Construye las URLs DASH y HLS usando el nombre de la ciudad
  const baseUrl = `https://gdie2504.ltim.uib.es/videos/${city}/out/`;
  config.video.dashUrl = `${baseUrl}manifest.mpd`;
  config.video.hlsUrl = `${baseUrl}manifest.m3u8`;

  // Rutas de los VTT
  const cityCap = city.charAt(0).toUpperCase() + city.slice(1);
  config.vtt.explanations = `vtts/${city}/explicaciones${cityCap}.vtt`;
  config.vtt.subtitles = `vtts/${city}/subtitulos${cityCap}.vtt`;
  config.vtt.locations = `vtts/${city}/ubicaciones${cityCap}.vtt`;

  // Título de la página
  config.video.title = `Tour en ${cityCap}`;
  document.getElementById("cityName").textContent = config.video.title;

  // Centro del mapa según ciudad
  if (config.cityCoordinates[city]) {
    config.map.center = config.cityCoordinates[city];
  }

  // Si no hay quality en la URL, redirigimos solo para incluir ciudad
  if (!params.get("city")) {
    const newURL = `${window.location.pathname}?city=${city}`;
    window.location.replace(newURL);
  }
}

// Export configuration and functions
window.config = config;
window.initializeConfig = initializeConfig;
