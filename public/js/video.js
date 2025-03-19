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

  // Override video quality with URL parameter if provided
  if (quality) {
    videoQuality = quality;
  }

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

  // Redirect to URL with quality parameter
  if (!params.get("quality")) {
    const newURL = `${window.location.pathname}?city=${city}&quality=${window.videoQuality}`;
    window.location.href = newURL;
  }

  // Set selected quality in the selector
  const qualitySelector = document.getElementById("quality");
  qualitySelector.value = window.videoQuality;
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
    transcriptElement.textContent = `Intentando cargar: ${vttFile}`;
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

    // Show initial message
    if (explanationSegments.length > 0) {
      transcriptElement.innerHTML =
        "<div>Reproduciendo el video para ver la explicación...</div>";
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
  } else {
    // If there's no explanation for this moment, show a message
    transcriptElement.innerHTML =
      "<div>No hay explicación para este momento del video</div>";
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
  const video = document.getElementById("videoPlayer");
  const tracks = video.textTracks;

  // Obtener la ciudad de la URL actual del video
  const city = videoURL.split("/")[1]; // e.g., "madrid" from "videos/madrid/videoMadrid_4k.mp4"

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    let subtitleURL = `vtts/${city}/subtitulos${
      city.charAt(0).toUpperCase() + city.slice(1)
    }`;
    if (track.language === language) {
      track.mode = "showing";
      track.src = `${subtitleURL}.vtt`;
    } else {
      track.mode = "hidden";
    }
  }
}

function setExplanations(language) {
  console.log("setExplanations language: " + language);

  // Get the current language from the player if not specified
  if (!language) {
    const player = document.querySelector(".plyr").plyr;
    const activeTracks = Array.from(document.querySelectorAll("track")).filter(
      (track) => track.kind === "subtitles" && track.track.mode === "showing"
    );

    if (activeTracks.length > 0) {
      // Extract language from the track ID
      const trackId = activeTracks[0].id;
      language = trackId.split("_")[1];
      console.log("Language detected from active track: " + language);
    } else {
      language = "es"; // Default fallback
    }
  }

  // Obtener la ciudad de la URL actual del video
  const city = videoURL.split("/")[1]; // e.g., "madrid" from "videos/madrid/videoMadrid_4k.mp4"

  // Update the explanations track src
  var track = document.getElementById("explanationsTrack");

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

  // Update the track src
  if (track) {
    track.src = vttURL;
  }

  // Reload the VTT content to update the displayed explanation
  loadVTTContent();
}

function changeLanguage(language) {
  console.log("changeLanguage language: " + language);
  currentLanguage = language;
  setSubtitles(language);
  setExplanations(language);
}

function setVideoSource(quality) {
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city");

  // Redirect to URL with new quality parameter
  const newURL = `${window.location.pathname}?city=${city}&quality=${quality}`;
  window.location.href = newURL;

  // Obtener la ciudad de la URL actual del video
  let newVideoURL = `videos/${city}/video${
    city.charAt(0).toUpperCase() + city.slice(1)
  }_${window.videoQuality}.mp4`;

  // Guardar la posición actual del video
  const currentTime = videoElement.currentTime;
  const isPaused = videoElement.paused;

  // Actualizar la fuente del video
  source.src = newVideoURL;

  // Recargar el video
  videoElement.load();

  // Restaurar la posición y el estado de reproducción
  videoElement.addEventListener("loadedmetadata", function onLoadedMetadata() {
    videoElement.currentTime = currentTime;
    if (!isPaused) {
      videoElement.play();
    }
    videoElement.removeEventListener("loadedmetadata", onLoadedMetadata);
    console.log(`Video cambiado a calidad: ${quality}`);
  });
}
// Initialize the video player with Plyr
function initializeVideoPlayer() {
  const videoElement = document.getElementById("videoPlayer");

  // Configuración de Plyr
  player = new Plyr(videoElement, {
    controls: [
      "play-large",
      "play",
      "progress",
      "current-time",
      "mute",
      "volume",
      "captions",
      "settings",
      "pip",
      "airplay",
      "fullscreen",
    ],
  });

  // Listen for captions language change
  player.on("languagechange", function () {
    console.log("Language changed in player");
    const currentTrack = player.currentTrack;
    if (currentTrack !== -1) {
      const tracks = player.media.textTracks;
      const activeTrack = tracks[currentTrack];
      if (activeTrack) {
        const language = activeTrack.language;
        console.log("Active track language:", language);
        // Update explanations with the new language
        setExplanations(language);
      }
    }
  });

  // Obtener la ciudad de la URL actual del video
  const city = videoURL.split("/")[1]; // e.g., "madrid" from "videos/madrid/videoMadrid_4k.mp4"
  let subtitleURL = `vtts/${city}/subtitulos${
    city.charAt(0).toUpperCase() + city.slice(1)
  }`;

  player.source = {
    type: "video",
    sources: [
      {
        src: videoURL,
        type: "video/mp4",
      },
      {
        src: videoURL.replace(".mp4", ".webm"),
        type: "video/webm",
      },
    ],
    tracks: [
      {
        kind: "subtitles",
        label: "Español",
        srclang: "es",
        src: `${subtitleURL}.vtt`,
        default: true,
      },
      {
        kind: "subtitles",
        label: "Inglés",
        srclang: "en",
        src: `${subtitleURL}_en.vtt`,
      },
      {
        kind: "subtitles",
        label: "Catalán",
        srclang: "ca",
        src: `${subtitleURL}_ca.vtt`,
      },
    ],
  };

  player.on("timeupdate", (event) => {
    if (explanationSegments.length > 0) {
      updateExplanation(event.detail.plyr.currentTime);
    }
    updateMap(event.detail.plyr.currentTime);
  });

  player.on("loadeddata", () => {
    console.log("Video cargado correctamente");
    loadVTTContent();
  });

  // Set initial subtitles language
  setSubtitles(currentLanguage);

  // Set initial video source
  setVideoSource();
}

// Initialize everything when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Create the explanations track element if it doesn't exist
  if (!document.getElementById("explanationsTrack")) {
    const videoPlayer = document.getElementById("videoPlayer");
    const explanationsTrack = document.createElement("track");
    explanationsTrack.id = "explanationsTrack";
    explanationsTrack.kind = "metadata";
    explanationsTrack.label = "Explicaciones";
    explanationsTrack.src = "vtts/madrid/explicacionesMadrid.vtt";
    videoPlayer.appendChild(explanationsTrack);
  }

  initializeVideoPage();
  loadLocationsVTT();
  initMap();
  initializeVideoPlayer();

  // Ocultar etiquetas de ubicación que aparecen en el video
  // Esto necesita ejecutarse después de que el video se ha cargado
  setTimeout(() => {
    // Desactivar todas las pistas de texto que contengan ubicaciones
    const tracks = document.querySelector("#videoPlayer").textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      // Si la pista contiene "[" (formato de ubicaciones), ocultarla
      if (track.label.includes("[")) {
        track.mode = "hidden";
      }
    }

    // Forzar la eliminación de cualquier etiqueta de ubicación visible
    const videoContainer = document.querySelector(".video-container");
    const locationLabels = videoContainer.querySelectorAll(
      'div[style*="position: absolute"]'
    );
    locationLabels.forEach((label) => label.remove());

    console.log("Se han ocultado las etiquetas de ubicación");
  }, 500);

  // Add language selector
  const languageSelector = document.createElement("select");
  languageSelector.id = "languageSelector";
  languageSelector.innerHTML = `
    <option value="es">Español</option>
    <option value="en">English</option>
    <option value="ca">Català</option>
  `;
  languageSelector.addEventListener("change", (event) => {
    changeLanguage(event.target.value);
  });
  document
    .querySelector(".plyr")
    .parentNode.insertBefore(
      languageSelector,
      document.querySelector(".plyr").nextSibling
    );
});
