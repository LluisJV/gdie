// Main initialization script

// Initialize everything when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize configuration with URL parameters
  initializeConfig();

  // Load location data
  loadLocationsVTT();

  // Initialize map
  initMap();

  // Initialize TTS functionality
  initializeTTS();

  // Initialize video player
  initializeVideoPlayer();

  console.log("Video page initialized successfully");

  // Protocol switcher functionality
  const protoSelect = document.getElementById("protocolSwitcher");
  if (protoSelect) {
    protoSelect.addEventListener("change", function () {
      const selectedProto = this.value;
      // Call the function to change protocol
      if (typeof initializeVideoPlayer === "function") {
        initializeVideoPlayer(selectedProto);
      }
    });
  }
});
