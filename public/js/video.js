// Video player and map functionality

// Global variables
let videoURL = "";
let title = "Tour en la ciudad";
let vttURL = "";
let subtitlesURL = ""; // Variable for subtitles
let locationsURL = ""; // Variable for locations
let explanationSegments = [];
let locationSegments = []; // Array to store locations
let map = null;
let markers = [];
let currentLanguage = "es"; // Default language
let player = null;
let currentCity = ""; // Track current city
let currentQuality = ""; // Track current quality

// Default coordinates for each city
const cityCoordinates = {
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3851, lng: 2.1734 },
  valencia: { lat: 39.4699, lng: -0.3763 },
  palma: { lat: 39.5696, lng: 2.6502 },
};

// Initial map configuration based on the city
let mapCenter = cityCoordinates.madrid;
let mapZoom = 12; // Adjust zoom for OpenLayers

// Get URL parameters
function initializeVideoPage() {
  let videoQuality;

  // Define breakpoints for media queries
  const desktop = window.matchMedia("(min-width: 1920px)"); // Example breakpoint for desktop
  const laptop = window.matchMedia(
    "(min-width: 1024px) and (max-width: 1919px)"
  ); // Example breakpoint for laptop
  const mobile = window.matchMedia("(max-width: 1023px)"); // Example breakpoint for mobile

  // Determine video quality based on screen size
  if (desktop.matches) {
    videoQuality = "4k";
  } else if (laptop.matches) {
    videoQuality = "1080p";
  } else if (mobile.matches) {
    videoQuality = "480p";
  } else {
    videoQuality = "1080p"; // Default quality if no media query matches
  }

  const params = new URLSearchParams(window.location.search);
  const city = params.get("city");
  const quality = params.get("quality");

  // Store the current city
  currentCity = city || "madrid";

  // Override video quality with URL parameter if provided
  if (quality) {
    videoQuality = quality;
  }

  // Store the current quality
  currentQuality = videoQuality;
  window.videoQuality = videoQuality;

  let videoExtension = `_${videoQuality}.mp4`;

  switch (city) {
    case "madrid":
      videoURL = `videos/madrid/videoMadrid${videoExtension}`;
      vttURL = "vtts/madrid/explicacionesMadrid.vtt";
      subtitlesURL = "vtts/madrid/subtitulosMadrid.vtt"; // URL for subtitles
      locationsURL = "vtts/madrid/ubicacionesMadrid.vtt"; // URL for locations
      title = "Tour en Madrid";
      mapCenter = cityCoordinates.madrid;
      break;
    case "barcelona":
      videoURL = `videos/barcelona/videoBarcelona${videoExtension}`;
      vttURL = "vtts/barcelona/explicacionesBarcelona.vtt";
      subtitlesURL = "vtts/barcelona/subtitulosBarcelona.vtt"; // URL for subtitles
      locationsURL = "vtts/barcelona/ubicacionesBarcelona.vtt"; // URL for locations
      title = "Tour en Barcelona";
      mapCenter = cityCoordinates.barcelona;
      break;
    case "valencia":
      videoURL = `videos/valencia/videoValencia${videoExtension}`;
      vttURL = "vtts/valencia/explicacionesValencia.vtt";
      subtitlesURL = "vtts/valencia/subtitulosValencia.vtt"; // URL for subtitles
      locationsURL = "vtts/valencia/ubicacionesValencia.vtt"; // URL for locations
      title = "Tour en Valencia";
      mapCenter = cityCoordinates.valencia;
      break;
    case "palma":
      videoURL = `videos/palma/videoPalma${videoExtension}`;
      vttURL = "vtts/palma/explicacionesPalma.vtt";
      subtitlesURL = "vtts/palma/subtitulosPalma.vtt"; // URL for subtitles
      locationsURL = "vtts/palma/ubicacionesPalma.vtt"; // URL for locations
      title = "Tour en Palma";
      mapCenter = cityCoordinates.palma;
      break;
    default:
      videoURL = "";
      title = "Video no encontrado";
  }

  // Set the page title
  document.getElementById("cityName").textContent = title;

  // Redirect to URL with quality parameter if not provided
  if (!params.get("quality")) {
    const newURL = `${window.location.pathname}?city=${city}&quality=${window.videoQuality}`;
    window.location.href = newURL;
  }
}

// Initialize the map
function initMap() {
  map = new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM(),
      }),
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([mapCenter.lng, mapCenter.lat]), // OpenLayers uses [longitude, latitude]
      zoom: mapZoom,
    }),
  });
  console.log("OpenLayers map initialized");
}

// Function to add a marker to the map
function addMarker(location, name) {
  const marker = new ol.Feature({
    geometry: new ol.geom.Point(
      ol.proj.fromLonLat([location.lng, location.lat])
    ),
  });

  marker.setStyle(
    new ol.style.Style({
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({
          color: "#3399CC",
        }),
        stroke: new ol.style.Stroke({
          color: "#fff",
          width: 2,
        }),
      }),
    })
  );

  const vectorSource = new ol.source.Vector({
    features: [marker], // Add the marker to the source
  });

  const markerLayer = new ol.layer.Vector({
    source: vectorSource,
  });

  map.addLayer(markerLayer);
  markers.push(markerLayer);
}

// Function to clear all markers from the map
function clearMarkers() {
  markers.forEach((marker) => {
    map.removeLayer(marker);
  });
  markers = [];
}

// Load and parse the locations VTT file
async function loadLocationsVTT() {
  if (!locationsURL) {
    console.log("No hay archivo de ubicaciones disponible");
    return;
  }

  try {
    console.log(
      `Intentando cargar archivo de ubicaciones desde: ${locationsURL}`
    );

    const response = await fetch(locationsURL);
    if (!response.ok) {
      console.error(
        `Error al cargar el archivo de ubicaciones: ${response.status} ${response.statusText}`
      );
      return;
    }

    console.log("Archivo de ubicaciones cargado correctamente");
    const text = await response.text();

    const lines = text.split("\n");
    console.log(
      `Número de líneas en el archivo de ubicaciones: ${lines.length}`
    );

    // Parse the locations VTT file
    let currentSegment = null;
    locationSegments = []; // Reset the locations array

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and WEBVTT header
      if (line === "" || line === "WEBVTT") continue;

      // Skip cue numbers
      if (/^\d+$/.test(line)) continue;

      // Check if it's a timestamp line
      if (line.includes("-->")) {
        const [startTime, endTime] = line.split("-->").map((t) => t.trim());

        // The next line should contain the name and coordinates
        if (i + 1 < lines.length) {
          const locationLine = lines[i + 1].trim();
          // Expected format: "Place name [lat, lng]"
          const locationMatch = locationLine.match(
            /(.*)\s+\[([-\d.]+),\s*([-\d.]+)\]/
          );

          if (locationMatch) {
            const name = locationMatch[1].trim();
            const lat = parseFloat(locationMatch[2]);
            const lng = parseFloat(locationMatch[3]);

            currentSegment = {
              start: timeToSeconds(startTime),
              end: timeToSeconds(endTime),
              name: name,
              coordinates: { lat: lat, lng: lng },
            };

            locationSegments.push(currentSegment);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error al cargar las ubicaciones: ${error.message}`);
  }
}

// Load and parse the explanations VTT file
async function loadVTTContent() {
  console.log("loadVTTContent called");
  const transcriptElement = document.getElementById("transcriptText");
  let vttFile = vttURL;

  if (!vttFile) {
    transcriptElement.textContent = "Explicación no disponible";
    return;
  }

  try {
    // Solo muestra el mensaje de carga si no hay explicaciones previas
    if (explanationSegments.length === 0) {
      transcriptElement.textContent = `Cargando explicaciones...`;
    }
    console.log(`Intentando cargar archivo VTT desde: ${vttFile}`);

    const response = await fetch(vttFile);
    if (!response.ok) {
      const errorMsg = `Error al cargar el archivo VTT: ${response.status} ${response.statusText}`;
      console.error(errorMsg);
      transcriptElement.textContent = errorMsg;
      throw new Error(errorMsg);
    }

    console.log("Archivo VTT cargado correctamente");
    const text = await response.text();
    console.log("Contenido del archivo VTT:", text.substring(0, 100) + "...");

    const lines = text.split("\n");
    console.log(`Número de líneas en el archivo: ${lines.length}`);

    // Parse the VTT file
    let currentSegment = null;
    explanationSegments = []; // Reset the segments array

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and WEBVTT header
      if (line === "" || line === "WEBVTT") continue;

      // Skip cue numbers
      if (/^\d+$/.test(line)) continue;

      // Check if it's a timestamp line
      if (line.includes("-->")) {
        const [startTime, endTime] = line.split("-->").map((t) => t.trim());
        currentSegment = {
          start: timeToSeconds(startTime),
          end: timeToSeconds(endTime),
          text: "",
        };
        console.log(`Nuevo segmento: ${startTime} --> ${endTime}`);
        continue;
      }

      // If we have a current segment and this line is not a timestamp, it's text
      if (currentSegment) {
        if (currentSegment.text) {
          currentSegment.text += " " + line;
        } else {
          currentSegment.text = line;
        }

        // If the next line is empty or a timestamp, save this segment
        if (
          i + 1 >= lines.length ||
          lines[i + 1].trim() === "" ||
          lines[i + 1].includes("-->") ||
          /^\d+$/.test(lines[i + 1].trim())
        ) {
          explanationSegments.push(currentSegment);
          console.log(
            `Segmento añadido: ${currentSegment.start}-${
              currentSegment.end
            }: "${currentSegment.text.substring(0, 30)}..."`
          );
          currentSegment = null;
        }
      }
    }

    console.log(
      `Total de segmentos encontrados: ${explanationSegments.length}`
    );

    // Show initial message only if there are segments and player exists
    if (explanationSegments.length > 0) {
      if (player) {
        // Si el reproductor ya está inicializado, actualiza la explicación con el tiempo actual
        updateExplanation(player.currentTime());
      } else {
        // Si el reproductor no está listo, muestra un mensaje inicial
        transcriptElement.innerHTML =
          "<div>Inicia el video para ver las explicaciones</div>";
      }
      console.log("Listo para mostrar explicaciones durante la reproducción");
    } else {
      transcriptElement.textContent =
        "No se encontraron explicaciones en el archivo";
      console.log("No se encontraron segmentos de explicación en el archivo");
    }
  } catch (error) {
    const errorMsg = `Error al cargar la explicación: ${error.message}`;
    transcriptElement.textContent = errorMsg;
    console.error(errorMsg);
  }
}

// Function to convert VTT time format (HH:MM:SS.mmm) to seconds
function timeToSeconds(timeString) {
  const parts = timeString.split(":");
  let seconds = 0;

  if (parts.length === 3) {
    // Format HH:MM:SS.mmm
    seconds =
      parseFloat(parts[0]) * 3600 +
      parseFloat(parts[1]) * 60 +
      parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // Format MM:SS.mmm
    seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    // Format SS.mmm
    seconds = parseFloat(parts[0]);
  }

  return seconds;
}

// Function to update the explanation based on the current video time
function updateExplanation(currentTime) {
  console.log(`updateExplanation called with currentTime: ${currentTime}`);
  const transcriptElement = document.getElementById("transcriptText");
  let currentExplanation = null;

  // Find the segment that corresponds to the current time
  for (const segment of explanationSegments) {
    if (currentTime >= segment.start && currentTime <= segment.end) {
      currentExplanation = segment;
      break;
    }
  }

  // Update the explanation text
  if (currentExplanation) {
    transcriptElement.innerHTML = `<div class="current-explanation">${currentExplanation.text}</div>`;
  } else if (explanationSegments.length > 0) {
    // Si hay segmentos pero ninguno corresponde al tiempo actual
    transcriptElement.innerHTML =
      "<div>Avanza el video para ver las explicaciones</div>";
  } else {
    // Si no hay explicaciones cargadas
    transcriptElement.innerHTML = "<div>No hay explicaciones disponibles</div>";
  }
}

// Function to update the map based on the current video time
function updateMap(currentTime) {
  // If there are no locations or no map, exit
  if (locationSegments.length === 0 || !map) return;

  let currentLocation = null;

  // Find the location that corresponds to the current time
  for (const segment of locationSegments) {
    if (currentTime >= segment.start && currentTime <= segment.end) {
      currentLocation = segment;
      break;
    }
  }

  // If there is a location for this time, show it on the map only (not as an overlay on the video)
  if (currentLocation) {
    // Clear all existing markers
    clearMarkers();

    // Add a new marker for the current location
    addMarker(currentLocation.coordinates, currentLocation.name);

    // Center the map on the location
    const olLocation = ol.proj.fromLonLat([
      currentLocation.coordinates.lng,
      currentLocation.coordinates.lat,
    ]);
    map.getView().setCenter(olLocation);

    console.log(`Map updated to: ${currentLocation.name}`);

    // Remove any existing location labels from the video
    const existingLabels = document.querySelectorAll(".location-label");
    existingLabels.forEach((label) => {
      label.parentNode.removeChild(label);
    });
  }
}

function setSubtitles(language) {
  console.log("setSubtitles language: " + language);
  if (!player) return;

  // Get all text tracks
  const tracks = player.textTracks();

  // Set the active subtitle track based on language
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (track.kind === "subtitles") {
      if (track.language === language) {
        track.mode = "showing";
      } else {
        track.mode = "disabled";
      }
    }
  }
}

function setExplanations(language) {
  console.log("setExplanations language: " + language);

  // Get the city from the URL
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city");

  if (!city) return;

  // Set the correct VTT file path based on language
  let explanationsVTT = `vtts/${city}/explicaciones${
    city.charAt(0).toUpperCase() + city.slice(1)
  }`;

  if (language === "es") {
    vttURL = `${explanationsVTT}.vtt`;
  } else if (language === "en") {
    vttURL = `${explanationsVTT}_en.vtt`;
  } else if (language === "ca") {
    vttURL = `${explanationsVTT}_ca.vtt`;
  } else {
    vttURL = `${explanationsVTT}.vtt`;
  }

  console.log("Setting explanations VTT URL to: " + vttURL);

  // Update the track for explanations metadata
  if (player) {
    const tracks = player.textTracks();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "metadata" && track.label === "Explicaciones") {
        track.src = vttURL;
      }
    }
  }

  // Reload the VTT content to update the displayed explanation
  loadVTTContent().then(() => {
    // Actualizar inmediatamente la explicación con el tiempo actual del video
    if (player && player.currentTime) {
      updateExplanation(player.currentTime());
    }
  });
}

function changeLanguage(language) {
  console.log("changeLanguage language: " + language);
  currentLanguage = language;
  setSubtitles(language);
  setExplanations(language);

  // Update language selector if it exists
  const languageSelector = document.getElementById("languageSelector");
  if (languageSelector) {
    languageSelector.value = language;
  }
}

// Function to change video quality
function changeQuality(quality) {
  console.log(`Changing quality to: ${quality}`);
  if (quality === currentQuality) return;

  currentQuality = quality;

  // Save current playback state
  const currentTime = player.currentTime();
  const isPaused = player.paused();

  // Update URL with new quality
  const params = new URLSearchParams(window.location.search);
  params.set("quality", quality);
  const newURL = `${window.location.pathname}?${params.toString()}`;

  // Update browser history without reloading the page
  window.history.replaceState({}, "", newURL);

  // Construct new video source URL
  let cityCapitalized =
    currentCity.charAt(0).toUpperCase() + currentCity.slice(1);
  const newSrc = `videos/${currentCity}/video${cityCapitalized}_${quality}.mp4`;

  console.log(`New video source: ${newSrc}`);

  // Update video source
  player.src({ type: "video/mp4", src: newSrc });

  // Restore playback state after source change
  player.one("loadedmetadata", function () {
    player.currentTime(currentTime);
    if (!isPaused) {
      player.play();
    }
    console.log(
      `Video quality changed to ${quality}, resuming at ${currentTime}s`
    );
  });
}

// Function to prepare sources array for video.js quality selector
function getSourcesForSelectorPlugin() {
  let cityCapitalized =
    currentCity.charAt(0).toUpperCase() + currentCity.slice(1);

  return [
    {
      src: `videos/${currentCity}/video${cityCapitalized}_4k.mp4`,
      type: "video/mp4",
      label: "4K",
      selected: currentQuality === "4k",
    },
    {
      src: `videos/${currentCity}/video${cityCapitalized}_1080p.mp4`,
      type: "video/mp4",
      label: "1080p",
      selected: currentQuality === "1080p",
    },
    {
      src: `videos/${currentCity}/video${cityCapitalized}_480p.mp4`,
      type: "video/mp4",
      label: "480p",
      selected: currentQuality === "480p",
    },
  ];
}

// Initialize the video player with Video.js
function initializeVideoPlayer() {
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
  player = videojs("videoPlayer", {
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
        "fullscreenToggle",
        "subtitlesButton",
      ],
    },
    plugins: {
      qualitySelector: false,
    },
  });

  // Add the explanations track if it doesn't exist
  player.ready(function () {
    console.log("Video.js player is ready");

    // Set initial video source
    player.src({
      type: "video/mp4",
      src: videoURL,
    });

    // Remove existing subtitle tracks
    const existingTracks = player.remoteTextTracks();
    const tracksToRemove = Array.from(existingTracks);
    tracksToRemove.forEach((track) => {
      player.removeRemoteTextTrack(track);
    });

    // Add subtitle tracks with correct sources
    const cityCapitalized =
      currentCity.charAt(0).toUpperCase() + currentCity.slice(1);

    // Add Spanish subtitles
    player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "es",
        label: "Español",
        src: `vtts/${currentCity}/subtitulos${cityCapitalized}.vtt`,
        default: currentLanguage === "es",
      },
      false
    );

    // Add English subtitles
    player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "en",
        label: "English",
        src: `vtts/${currentCity}/subtitulos${cityCapitalized}_en.vtt`,
      },
      false
    );

    // Add Catalan subtitles
    player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "ca",
        label: "Català",
        src: `vtts/${currentCity}/subtitulos${cityCapitalized}_ca.vtt`,
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
      if (player.controlBar.getChild("QualitySelector") === undefined) {
        // Use the plugin manually
        player.controlBar.addChild("QualitySelector", {});
      }
      player.updateSrc(sources);

      // Add quality change event listener manually
      player.on("qualityRequested", function (event, newSource) {
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
    const textTracks = player.textTracks();

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
      player.addRemoteTextTrack(
        {
          kind: "metadata",
          src: vttURL,
          label: "Explicaciones",
          default: true,
        },
        false
      );
    }

    // Set initial subtitles language
    setSubtitles(currentLanguage);

    // Load explanations
    loadVTTContent();
  });

  // Handle timeupdate event (equivalent to Plyr's timeupdate)
  player.on("timeupdate", function () {
    const currentTime = player.currentTime();
    if (explanationSegments.length > 0) {
      updateExplanation(currentTime);
    }
    updateMap(currentTime);
  });

  // Handle text track changes (for subtitles)
  player.on("texttrackchange", function () {
    const tracks = player.textTracks();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "subtitles" && track.mode === "showing") {
        console.log("Active subtitle track changed to:", track.language);
        setExplanations(track.language);
        break;
      }
    }
  });
}

// Function to create a manual quality selector as a fallback
function createManualQualityControl(sources) {
  // Quality control is handled by our custom HD button
  console.log("Using custom HD quality control");
}

// Initialize everything when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  initializeVideoPage();
  loadLocationsVTT();
  initMap();
  initializeVideoPlayer();
});
