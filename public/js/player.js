// Video player functionality

// Initialize the video player with Video.js
function initializeVideoPlayer() {
  // Register custom TTS button component first
  registerTTSButtonComponent();

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
  window.player = videojs("videoPlayer", {
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
        "TTSButton", // Add our custom TTS button to the control bar
        "subtitlesButton",
        "fullscreenToggle",
      ],
    },
    plugins: {
      qualitySelector: false,
    },
  });

  // Add the explanations track if it doesn't exist
  window.player.ready(function () {
    console.log("Video.js player is ready");

    // Set initial video source
    window.player.src({
      type: "video/mp4",
      src: config.video.url,
    });

    // Remove existing subtitle tracks
    const existingTracks = window.player.remoteTextTracks();
    const tracksToRemove = Array.from(existingTracks);
    tracksToRemove.forEach((track) => {
      window.player.removeRemoteTextTrack(track);
    });

    // Add subtitle tracks with correct sources
    const cityCapitalized =
      config.city.name.charAt(0).toUpperCase() + config.city.name.slice(1);

    // Add Spanish subtitles
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "es",
        label: "Español",
        src: `vtts/${config.city.name}/subtitulos${cityCapitalized}.vtt`,
        default: config.language.current === "es",
      },
      false
    );

    // Add English subtitles
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "en",
        label: "English",
        src: `vtts/${config.city.name}/subtitulos${cityCapitalized}_en.vtt`,
      },
      false
    );

    // Add Catalan subtitles
    window.player.addRemoteTextTrack(
      {
        kind: "subtitles",
        srclang: "ca",
        label: "Català",
        src: `vtts/${config.city.name}/subtitulos${cityCapitalized}_ca.vtt`,
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
      if (window.player.controlBar.getChild("QualitySelector") === undefined) {
        // Use the plugin manually
        window.player.controlBar.addChild("QualitySelector", {});
      }
      window.player.updateSrc(sources);

      // Add quality change event listener manually
      window.player.on("qualityRequested", function (event, newSource) {
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
    const textTracks = window.player.textTracks();

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
      window.player.addRemoteTextTrack(
        {
          kind: "metadata",
          src: config.vtt.explanations,
          label: "Explicaciones",
          default: true,
        },
        false
      );
    }

    // Set initial subtitles language
    setSubtitles(config.language.current);

    // Load explanations
    loadVTTContent();
  });

  // Handle timeupdate event (equivalent to Plyr's timeupdate)
  window.player.on("timeupdate", function () {
    const currentTime = window.player.currentTime();
    if (config.segments.explanations.length > 0) {
      updateExplanation(currentTime);
    }
    updateMap(currentTime);
  });

  // Handle text track changes (for subtitles)
  window.player.on("texttrackchange", function () {
    const tracks = window.player.textTracks();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "subtitles" && track.mode === "showing") {
        console.log("Active subtitle track changed to:", track.language);

        // Update current language for TTS
        if (config.language.current !== track.language) {
          config.language.current = track.language;
          console.log(
            "Updated currentLanguage for TTS to:",
            config.language.current
          );

          // If TTS is enabled and there's active speech, restart it with the new language
          if (config.tts.enabled && config.tts.currentSpeech) {
            window.speechSynthesis.cancel();
            config.tts.currentSpeech = null;

            // If there are active cues, speak them with the new language
            if (track.activeCues && track.activeCues.length > 0) {
              const cueText = track.activeCues[0].text;
              speakSubtitle(cueText);
            }
          }
        }

        // Update the TTS button state if it exists
        const ttsButton = window.player.controlBar.getChild("TTSButton");
        if (ttsButton) {
          ttsButton.updateButtonState();
        }

        setExplanations(track.language);

        // Add cuechange handler for the active track
        track.removeEventListener("cuechange", handleSubtitleCueChange);
        track.addEventListener("cuechange", handleSubtitleCueChange);
        break;
      }
    }
  });

  // Function to handle subtitle cue changes for TTS
  function handleSubtitleCueChange(event) {
    if (config.tts.enabled && this.activeCues && this.activeCues.length > 0) {
      // Get the text of the active cue
      const cueText = this.activeCues[0].text;
      // Speak the subtitle text
      speakSubtitle(cueText);
    }
  }
}

// Function to create a manual quality selector as a fallback
function createManualQualityControl(sources) {
  // Quality control is handled by our custom HD button
  console.log("Using custom HD quality control");
}

// Export player functions
window.initializeVideoPlayer = initializeVideoPlayer;
window.createManualQualityControl = createManualQualityControl;
