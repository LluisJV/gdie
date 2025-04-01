// Language and subtitles management

function setSubtitles(language) {
  console.log("setSubtitles language: " + language);
  if (!window.player) return;

  // Get all text tracks
  const tracks = window.player.textTracks();

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

  // Get the city from the URL or from current configuration
  const city = config.city.name;

  if (!city) return;

  // Set the correct VTT file path based on language
  let explanationsVTT = `vtts/${city}/explicaciones${
    city.charAt(0).toUpperCase() + city.slice(1)
  }`;

  if (language === "es") {
    config.vtt.explanations = `${explanationsVTT}.vtt`;
  } else if (language === "en") {
    config.vtt.explanations = `${explanationsVTT}_en.vtt`;
  } else if (language === "ca") {
    config.vtt.explanations = `${explanationsVTT}_ca.vtt`;
  } else {
    config.vtt.explanations = `${explanationsVTT}.vtt`;
  }

  console.log("Setting explanations VTT URL to: " + config.vtt.explanations);

  // Update the track for explanations metadata
  if (window.player) {
    const tracks = window.player.textTracks();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "metadata" && track.label === "Explicaciones") {
        track.src = config.vtt.explanations;
      }
    }
  }

  // Reload the VTT content to update the displayed explanation
  loadVTTContent().then(() => {
    // Actualizar inmediatamente la explicación con el tiempo actual del video
    if (window.player && window.player.currentTime) {
      updateExplanation(window.player.currentTime());
    }
  });
}

function changeLanguage(language) {
  console.log("changeLanguage language: " + language);
  config.language.current = language;
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
  if (quality === config.video.currentQuality) return;

  config.video.currentQuality = quality;

  // Save current playback state
  const currentTime = window.player.currentTime();
  const isPaused = window.player.paused();

  // Update URL with new quality
  const params = new URLSearchParams(window.location.search);
  params.set("quality", quality);
  const newURL = `${window.location.pathname}?${params.toString()}`;

  // Update browser history without reloading the page
  window.history.replaceState({}, "", newURL);

  // Construct new video source URL
  let cityCapitalized =
    config.city.name.charAt(0).toUpperCase() + config.city.name.slice(1);
  const newSrc = `videos/${config.city.name}/video${cityCapitalized}_${quality}.mp4`;

  console.log(`New video source: ${newSrc}`);

  // Update video source
  window.player.src({ type: "video/mp4", src: newSrc });

  // Restore playback state after source change
  window.player.one("loadedmetadata", function () {
    window.player.currentTime(currentTime);
    if (!isPaused) {
      window.player.play();
    }
    console.log(
      `Video quality changed to ${quality}, resuming at ${currentTime}s`
    );
  });
}

// Export language functions
window.setSubtitles = setSubtitles;
window.setExplanations = setExplanations;
window.changeLanguage = changeLanguage;
window.changeQuality = changeQuality;
