// Map functionality for video tours

// Initialize the map
function initMap() {
  config.map.instance = new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM(),
      }),
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([
        config.map.center.lng,
        config.map.center.lat,
      ]), // OpenLayers uses [longitude, latitude]
      zoom: config.map.zoom,
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

  config.map.instance.addLayer(markerLayer);
  config.map.markers.push(markerLayer);
}

// Function to clear all markers from the map
function clearMarkers() {
  config.map.markers.forEach((marker) => {
    config.map.instance.removeLayer(marker);
  });
  config.map.markers = [];
}

// Function to update the map based on the current video time
function updateMap(currentTime) {
  // If there are no locations or no map, exit
  if (config.segments.locations.length === 0 || !config.map.instance) return;

  let currentLocation = null;

  // Find the location that corresponds to the current time
  for (const segment of config.segments.locations) {
    if (currentTime >= segment.start && currentTime <= segment.end) {
      currentLocation = segment;
      break;
    }
  }

  // If there is a location for this time, show it on the map
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
    config.map.instance.getView().setCenter(olLocation);

    console.log(`Map updated to: ${currentLocation.name}`);

    // Remove any existing location labels from the video
    const existingLabels = document.querySelectorAll(".location-label");
    existingLabels.forEach((label) => {
      label.parentNode.removeChild(label);
    });
  }
}

// WebSocket Remote Control functionality
function initRemoteControl() {
  // URL del servidor WebSocket externo (cambiar según donde esté alojado)
  const wsServerUrl = "ws://localhost:8080"; // Cambiar a la IP o dominio donde esté el servidor
  let socket;

  // Intentar establecer la conexión WebSocket
  try {
    socket = new WebSocket(wsServerUrl);

    socket.onopen = () => {
      console.log("Conectado al servidor de control remoto");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Comando remoto recibido:", data);

        // Ignorar mensajes de sistema o confirmaciones
        if (data.type === "system" || data.type === "ack") {
          return;
        }

        // Verificar si el reproductor de video está disponible
        if (!window.player) {
          console.error("El reproductor de video no está inicializado");
          return;
        }

        // Manejar los diferentes comandos
        switch (data.action) {
          case "play":
            window.player.play();
            console.log("Reproducción iniciada por control remoto");
            break;

          case "pause":
            window.player.pause();
            console.log("Reproducción pausada por control remoto");
            break;

          case "seek":
            // Avanzar o retroceder el número de segundos especificado
            if (data.value !== undefined) {
              const currentTime = window.player.currentTime();
              const newTime = Math.max(0, currentTime + parseFloat(data.value));
              window.player.currentTime(newTime);
              console.log(`Tiempo ajustado a ${newTime}s por control remoto`);
            }
            break;

          case "volume":
            // Ajustar el volumen
            if (data.value !== undefined) {
              const currentVolume = window.player.volume();
              const newVolume = Math.min(
                1,
                Math.max(0, currentVolume + parseFloat(data.value))
              );
              window.player.volume(newVolume);
              console.log(
                `Volumen ajustado a ${Math.round(
                  newVolume * 100
                )}% por control remoto`
              );
            }
            break;

          default:
            console.warn("Comando desconocido:", data.action);
        }
      } catch (err) {
        console.error("Error al procesar mensaje del control remoto:", err);
      }
    };

    socket.onclose = () => {
      console.log("Desconectado del servidor de control remoto");
      // Intentar reconectar después de un tiempo
      setTimeout(initRemoteControl, 5000);
    };

    socket.onerror = (error) => {
      console.error("Error en la conexión WebSocket:", error);
    };
  } catch (err) {
    console.error("Error al inicializar el control remoto:", err);
  }
}

// Export map functions
window.initMap = initMap;
window.updateMap = updateMap;
window.initRemoteControl = initRemoteControl;

// Initialize remote control when the page loads
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar el control remoto después de un breve retraso para asegurar que el reproductor esté listo
  setTimeout(initRemoteControl, 1000);
});
