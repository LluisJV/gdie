// Configuration and global variables
const config = {
  // Video related variables
  video: {
    url: "",
    title: "Tour en la ciudad",
    currentQuality: "",
  },

  // Audio related variables
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
  // Define breakpoints for media queries
  const desktop = window.matchMedia("(min-width: 1920px)");
  const laptop = window.matchMedia(
    "(min-width: 1024px) and (max-width: 1919px)"
  );
  const mobile = window.matchMedia("(max-width: 1023px)");

  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city") || "madrid";
  const quality = params.get("quality");

  // Store the current city
  config.city.name = city;

  // Determine best streaming format based on browser support if not specified in URL
  let videoQuality;

  if (quality) {
    // Use explicit quality from URL parameter
    videoQuality = quality;
  } else {
    // Detect browser compatibility
    const supportsHLS = checkHLSSupport();
    const supportsDASH = checkDASHSupport();

    console.log(
      `Browser HLS support: ${supportsHLS}, DASH support: ${supportsDASH}`
    );

    // Choose streaming format based on support
    if (supportsDASH) {
      videoQuality = "dash"; // Prefer DASH if supported
    } else if (supportsHLS) {
      videoQuality = "hls"; // Fall back to HLS
    } else {
      // If neither is natively supported, Video.js may still handle them
      // with polyfills, but prefer HLS for mobile (better support generally)
      videoQuality = mobile.matches ? "hls" : "dash";
    }
  }

  // Store the current quality
  config.video.currentQuality = videoQuality;
  window.videoQuality = videoQuality;

  // Set the video URL (empty for now - will be set by player)
  config.video.url = "";

  // Set up other city-specific configurations
  const cityCapitalized = city.charAt(0).toUpperCase() + city.slice(1);

  switch (city) {
    case "madrid":
      config.vtt.explanations = "vtts/madrid/explicacionesMadrid.vtt";
      config.vtt.subtitles = "vtts/madrid/subtitulosMadrid.vtt";
      config.vtt.locations = "vtts/madrid/ubicacionesMadrid.vtt";
      config.video.title = "Tour en Madrid";
      config.map.center = config.cityCoordinates.madrid;
      break;
    case "barcelona":
      config.vtt.explanations = "vtts/barcelona/explicacionesBarcelona.vtt";
      config.vtt.subtitles = "vtts/barcelona/subtitulosBarcelona.vtt";
      config.vtt.locations = "vtts/barcelona/ubicacionesBarcelona.vtt";
      config.video.title = "Tour en Barcelona";
      config.map.center = config.cityCoordinates.barcelona;
      break;
    case "valencia":
      config.vtt.explanations = "vtts/valencia/explicacionesValencia.vtt";
      config.vtt.subtitles = "vtts/valencia/subtitulosValencia.vtt";
      config.vtt.locations = "vtts/valencia/ubicacionesValencia.vtt";
      config.video.title = "Tour en Valencia";
      config.map.center = config.cityCoordinates.valencia;
      break;
    case "palma":
      config.vtt.explanations = "vtts/palma/explicacionesPalma.vtt";
      config.vtt.subtitles = "vtts/palma/subtitulosPalma.vtt";
      config.vtt.locations = "vtts/palma/ubicacionesPalma.vtt";
      config.video.title = "Tour en Palma";
      config.map.center = config.cityCoordinates.palma;
      break;
    default:
      config.video.url = "";
      config.video.title = "Video no encontrado";
  }

  // Set the page title
  document.getElementById("cityName").textContent = config.video.title;

  // Redirect to URL with quality parameter if not provided
  if (!params.get("quality")) {
    const newURL = `${window.location.pathname}?city=${city}&quality=${window.videoQuality}`;
    window.location.href = newURL;
  }
}

// Helper function to check for native HLS support
function checkHLSSupport() {
  const video = document.createElement("video");

  // Test if browser can play HLS natively
  return (
    video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
    video.canPlayType("application/x-mpegURL") !== ""
  );
}

// Helper function to check for DASH support
function checkDASHSupport() {
  const video = document.createElement("video");

  // Most modern browsers that support MSE should be able to play DASH
  // This is a basic check for MSE support which is required for DASH
  return (
    "MediaSource" in window &&
    MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"')
  );
}

// Function to prepare sources array for video.js quality selector
function getSourcesForSelectorPlugin() {
  let cityCapitalized =
    config.city.name.charAt(0).toUpperCase() + config.city.name.slice(1);

  return [
    {
      src: `https://gdie2504.ltim.uib.es/videos/${config.city.name}/out/manifest.mpd`,
      type: "application/dash+xml",
      label: "DASH Adaptativo",
      selected: config.video.currentQuality === "dash",
    },
    {
      src: `https://gdie2504.ltim.uib.es/videos/${config.city.name}/out/manifest.m3u8`,
      type: "application/x-mpegURL",
      label: "HLS Adaptativo",
      selected: config.video.currentQuality === "hls",
    },
  ];
}

// Function to get available audio qualities
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
window.getSourcesForSelectorPlugin = getSourcesForSelectorPlugin;
window.getAudioSources = getAudioSources;
window.checkHLSSupport = checkHLSSupport;
window.checkDASHSupport = checkDASHSupport;
