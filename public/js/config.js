// Configuration and global variables
const config = {
  // Video related variables
  video: {
    url: "",
    title: "Tour en la ciudad",
    currentQuality: "",
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
  let videoQuality;

  // Define breakpoints for media queries
  const desktop = window.matchMedia("(min-width: 1920px)");
  const laptop = window.matchMedia(
    "(min-width: 1024px) and (max-width: 1919px)"
  );
  const mobile = window.matchMedia("(max-width: 1023px)");

  // Determine video quality based on screen size
  if (desktop.matches) {
    videoQuality = "4k";
  } else if (laptop.matches) {
    videoQuality = "1080p";
  } else if (mobile.matches) {
    videoQuality = "480p";
  } else {
    videoQuality = "1080p"; // Default quality
  }

  const params = new URLSearchParams(window.location.search);
  const city = params.get("city") || "madrid";
  const quality = params.get("quality");

  // Store the current city
  config.city.name = city;

  // Override video quality with URL parameter if provided
  if (quality) {
    videoQuality = quality;
  }

  // Store the current quality
  config.video.currentQuality = videoQuality;
  window.videoQuality = videoQuality;

  let videoExtension = `_${videoQuality}.mp4`;
  const cityCapitalized = city.charAt(0).toUpperCase() + city.slice(1);

  switch (city) {
    case "madrid":
      config.video.url = `videos/madrid/videoMadrid${videoExtension}`;
      config.vtt.explanations = "vtts/madrid/explicacionesMadrid.vtt";
      config.vtt.subtitles = "vtts/madrid/subtitulosMadrid.vtt";
      config.vtt.locations = "vtts/madrid/ubicacionesMadrid.vtt";
      config.video.title = "Tour en Madrid";
      config.map.center = config.cityCoordinates.madrid;
      break;
    case "barcelona":
      config.video.url = `videos/barcelona/videoBarcelona${videoExtension}`;
      config.vtt.explanations = "vtts/barcelona/explicacionesBarcelona.vtt";
      config.vtt.subtitles = "vtts/barcelona/subtitulosBarcelona.vtt";
      config.vtt.locations = "vtts/barcelona/ubicacionesBarcelona.vtt";
      config.video.title = "Tour en Barcelona";
      config.map.center = config.cityCoordinates.barcelona;
      break;
    case "valencia":
      config.video.url = `videos/valencia/videoValencia${videoExtension}`;
      config.vtt.explanations = "vtts/valencia/explicacionesValencia.vtt";
      config.vtt.subtitles = "vtts/valencia/subtitulosValencia.vtt";
      config.vtt.locations = "vtts/valencia/ubicacionesValencia.vtt";
      config.video.title = "Tour en Valencia";
      config.map.center = config.cityCoordinates.valencia;
      break;
    case "palma":
      config.video.url = `videos/palma/videoPalma${videoExtension}`;
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

// Function to prepare sources array for video.js quality selector
function getSourcesForSelectorPlugin() {
  let cityCapitalized =
    config.city.name.charAt(0).toUpperCase() + config.city.name.slice(1);

  return [
    {
      src: `videos/${config.city.name}/video${cityCapitalized}_4k.mp4`,
      type: "video/mp4",
      label: "4K",
      selected: config.video.currentQuality === "4k",
    },
    {
      src: `videos/${config.city.name}/video${cityCapitalized}_1080p.mp4`,
      type: "video/mp4",
      label: "1080p",
      selected: config.video.currentQuality === "1080p",
    },
    {
      src: `videos/${config.city.name}/video${cityCapitalized}_480p.mp4`,
      type: "video/mp4",
      label: "480p",
      selected: config.video.currentQuality === "480p",
    },
  ];
}

// Export configuration and functions
window.config = config;
window.initializeConfig = initializeConfig;
window.getSourcesForSelectorPlugin = getSourcesForSelectorPlugin;
