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

// Export map functions
window.initMap = initMap;
window.updateMap = updateMap;
