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

  // Check if already using this quality
  if (quality === config.video.currentQuality) return;

  // Save current playback state
  const currentTime = window.player.currentTime();
  const isPaused = window.player.paused();

  // Update current quality in config
  config.video.currentQuality = quality;

  // Update URL with new quality
  const params = new URLSearchParams(window.location.search);
  params.set("quality", quality);
  const newURL = `${window.location.pathname}?${params.toString()}`;

  // Update browser history without reloading the page
  window.history.replaceState({}, "", newURL);

  // Get the full list of sources
  const sources = getSourcesForSelectorPlugin();

  // Find the matching source for the selected quality
  let newSource;

  if (quality === "dash") {
    // Handle DASH streaming
    newSource = sources.find(
      (source) => source.type === "application/dash+xml"
    );
    console.log(`Switching to DASH streaming: ${newSource.src}`);
  } else if (quality === "hls") {
    // Handle HLS streaming
    newSource = sources.find(
      (source) => source.type === "application/x-mpegURL"
    );
    console.log(`Switching to HLS streaming: ${newSource.src}`);
  }

  // Update video source
  if (newSource) {
    window.player.src(newSource);

    // Restore playback state after source change
    window.player.one("loadedmetadata", function () {
      window.player.currentTime(currentTime);
      if (!isPaused) {
        window.player.play().catch((error) => {
          console.error("Error resuming playback:", error);
          // May need user interaction to resume in some browsers
        });
      }
      console.log(
        `Video quality changed to ${quality}, resuming at ${currentTime}s`
      );

      // Trigger custom event for quality change
      window.player.trigger("qualitySelected", { quality: quality });
    });
  } else {
    console.error(`Couldn't find source for quality: ${quality}`);
  }
}

// Function to change audio quality when using DASH streaming
function changeAudioQuality(quality) {
  console.log(`Changing audio quality to: ${quality}`);

  // Only proceed if we're using DASH
  if (config.video.currentQuality !== "dash") {
    console.log("Audio quality can only be changed when using DASH streaming");
    return;
  }

  // Check if already using this quality
  if (quality === config.audio.currentQuality) return;

  // Store the current quality
  config.audio.currentQuality = quality;

  // Get current playback state
  const currentTime = window.player.currentTime();
  const isPaused = window.player.paused();

  // Get the current DASH source
  const sources = getSourcesForSelectorPlugin();
  const dashSource = sources.find(
    (source) => source.type === "application/dash+xml"
  );

  if (!dashSource) {
    console.error("DASH source not found");
    return;
  }

  // We need to reload the DASH source to change audio track
  console.log(`Reloading DASH source with new audio quality: ${quality}`);

  try {
    // Get the DASH player
    const dashPlayer = window.player.dash && window.player.dash.mediaPlayer;

    if (dashPlayer) {
      // Find the appropriate audio track based on quality
      const audioTracks = dashPlayer.getTracksFor("audio");
      let targetTrack = null;

      if (audioTracks && audioTracks.length > 0) {
        console.log("Available audio tracks:", audioTracks);

        // Find the right track based on bitrate
        // Typically high = 320kbps, standard = 128kbps
        if (quality === "high") {
          // Find the track with the highest bitrate
          targetTrack = audioTracks.reduce((prev, current) =>
            prev.bitrateValue > current.bitrateValue ? prev : current
          );
        } else {
          // Find the track with the lowest bitrate
          targetTrack = audioTracks.reduce((prev, current) =>
            prev.bitrateValue < current.bitrateValue ? prev : current
          );
        }

        if (targetTrack) {
          console.log(
            `Setting audio track to: ${targetTrack.id}, bitrate: ${targetTrack.bitrateValue}`
          );
          dashPlayer.setCurrentTrack(targetTrack);

          // Update UI to reflect selected audio quality
          updateAudioQualityUI(quality);

          return; // Successfully changed the track without reloading
        }
      }
    }

    // If we couldn't change the track directly, we'll need to reload the source
    window.player.src(dashSource);

    // Restore playback state
    window.player.one("loadedmetadata", function () {
      window.player.currentTime(currentTime);
      if (!isPaused) {
        window.player.play().catch((error) => {
          console.error(
            "Error resuming playback after audio quality change:",
            error
          );
        });
      }
      console.log(
        `Video resumed after audio quality change at ${currentTime}s`
      );

      // Update UI
      updateAudioQualityUI(quality);
    });
  } catch (error) {
    console.error("Error changing audio quality:", error);
  }
}

// Helper function to update audio quality UI
function updateAudioQualityUI(quality) {
  // Update selected state in audio quality menu items
  const audioMenuItems = document.querySelectorAll(
    ".vjs-audio-quality-menu-item"
  );
  audioMenuItems.forEach((item) => {
    if (item.dataset.quality === quality) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });
}

// Export language functions
window.setSubtitles = setSubtitles;
window.setExplanations = setExplanations;
window.changeLanguage = changeLanguage;
window.changeQuality = changeQuality;
window.changeAudioQuality = changeAudioQuality;
