// Text-to-speech functionality

// Function to initialize the text-to-speech functionality
function initializeTTS() {
  // Check if speech synthesis is available
  if ("speechSynthesis" in window) {
    // Pre-cargar las voces disponibles
    let voices = [];

    function loadVoices() {
      voices = window.speechSynthesis.getVoices();
      console.log(`Loaded ${voices.length} speech synthesis voices`);

      // Log available languages
      let availableLanguages = new Set();
      voices.forEach((voice) => {
        availableLanguages.add(voice.lang);
      });
      console.log(
        "Available language codes:",
        [...availableLanguages].sort().join(", ")
      );

      // Check if there's any Catalan voice
      const catalanVoices = voices.filter((voice) =>
        voice.lang.startsWith("ca")
      );
      if (catalanVoices.length > 0) {
        console.log(
          `Found ${catalanVoices.length} Catalan voices:`,
          catalanVoices.map((v) => `${v.name} (${v.lang})`).join(", ")
        );
      } else {
        console.log(
          "No Catalan voices found. Will fall back to other languages for Catalan text."
        );
      }
    }

    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Try to load voices immediately (for browsers like Firefox)
    loadVoices();

    // Indicate success
    console.log("TTS initialized successfully");
  } else {
    // If speech synthesis is not supported, disable TTS globally
    config.tts.enabled = false;
    console.log("Speech synthesis not supported in this browser");
  }
}

// Function to speak subtitle text
function speakSubtitle(text) {
  if (!config.tts.enabled || !("speechSynthesis" in window) || !text) return;

  // Cancel any current speech
  if (config.tts.currentSpeech) {
    window.speechSynthesis.cancel();
  }

  // Create a new utterance
  const utterance = new SpeechSynthesisUtterance(text);

  // Set language based on current subtitle language
  let langCode = "es-ES"; // Default to Spanish

  // Get all available voices
  const voices = window.speechSynthesis.getVoices();

  switch (config.language.current) {
    case "es":
      langCode = "es-ES";
      break;
    case "en":
      langCode = "en-US";
      break;
    case "ca":
      // Para catalán, intentamos encontrar la mejor voz disponible
      let catalanVoice = null;

      // Primero buscamos voces específicas de catalán
      for (let voice of voices) {
        if (voice.lang === "ca-ES") {
          catalanVoice = voice;
          langCode = "ca-ES";
          break;
        } else if (voice.lang === "ca") {
          catalanVoice = voice;
          langCode = "ca";
          break;
        } else if (voice.lang.startsWith("ca-")) {
          catalanVoice = voice;
          langCode = voice.lang;
          break;
        }
      }

      // Si encontramos una voz en catalán, la usamos
      if (catalanVoice) {
        utterance.voice = catalanVoice;
        console.log(
          `Using Catalan voice: ${catalanVoice.name} (${catalanVoice.lang})`
        );
      } else {
        // Si no hay voz en catalán, intentamos una solución alternativa
        console.log(
          "No Catalan voice found, trying alternative approach for Catalan text"
        );

        // Transformaciones fonéticas básicas de catalán a español para la síntesis
        // Esto ayuda a que una voz española pronuncie mejor el texto catalán
        if (voices.some((v) => v.lang === "es-ES" || v.lang.startsWith("es"))) {
          // Usamos una voz española pero ajustamos la pronunciación
          langCode = "es-ES";

          // Sustituir caracteres/palabras catalanas para mejor pronunciación en español
          // Esta es una simplificación y no cubre todos los casos
          text = text
            .replace(/ŀl/g, "l·l") // ligadura ele geminada
            .replace(/·l/g, "l") // simplificar ele geminada
            .replace(/à/g, "a")
            .replace(/è/g, "e")
            .replace(/ò/g, "o")
            .replace(/ç/g, "s")
            .replace(/ï/g, "i");
        }
      }
      break;
    default:
      langCode = "es-ES";
  }

  utterance.lang = langCode;

  console.log(
    `Speaking subtitle in ${utterance.lang}${
      utterance.voice ? ` with voice ${utterance.voice.name}` : ""
    }: "${text.substring(0, 30)}${text.length > 30 ? "..." : ""}"`
  );

  // Store the current speech
  config.tts.currentSpeech = utterance;

  // Event handler for when speech is finished
  utterance.onend = function () {
    config.tts.currentSpeech = null;
  };

  // Event handler for errors
  utterance.onerror = function (event) {
    console.error("Speech synthesis error:", event.error);
    config.tts.currentSpeech = null;
  };

  // Speak the text
  window.speechSynthesis.speak(utterance);
}

// Function to register the TTS Button component for VideoJS
function registerTTSButtonComponent() {
  // Make sure VideoJS is available
  if (typeof videojs === "undefined") {
    console.error("VideoJS not loaded, cannot register TTS button");
    return;
  }

  // Get the component base class
  const VideoJsButton = videojs.getComponent("Button");

  // Create a TTS button class that extends Button
  class TTSButton extends VideoJsButton {
    constructor(player, options) {
      super(player, options);

      // Add the class for styling
      this.addClass("vjs-tts-button");

      // Set initial aria-label and title based on current TTS state
      this.updateButtonState();

      // Add click handler
      this.on("click", this.toggleTTS);
    }

    // Define a method to update the button's visual state
    updateButtonState() {
      if (config.tts.enabled) {
        this.addClass("vjs-tts-enabled");
        this.removeClass("vjs-tts-disabled");
        this.controlText("Desactivar lectura de subtítulos");
        this.el().setAttribute(
          "aria-label",
          "Desactivar lectura de subtítulos"
        );
        this.el().setAttribute("title", "Desactivar lectura de subtítulos");
      } else {
        this.removeClass("vjs-tts-enabled");
        this.addClass("vjs-tts-disabled");
        this.controlText("Activar lectura de subtítulos");
        this.el().setAttribute("aria-label", "Activar lectura de subtítulos");
        this.el().setAttribute("title", "Activar lectura de subtítulos");
      }
    }

    // Define the click handler
    toggleTTS() {
      // Toggle TTS state
      config.tts.enabled = !config.tts.enabled;
      console.log(
        `Text-to-speech ${config.tts.enabled ? "enabled" : "disabled"}`
      );

      // If disabled, cancel any current speech
      if (!config.tts.enabled && config.tts.currentSpeech) {
        window.speechSynthesis.cancel();
        config.tts.currentSpeech = null;
      }

      // Update button visual state
      this.updateButtonState();

      // If enabled and there's an active subtitle, try to read it
      if (config.tts.enabled && window.player) {
        const tracks = window.player.textTracks();
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          if (
            track.kind === "subtitles" &&
            track.mode === "showing" &&
            track.activeCues &&
            track.activeCues.length > 0
          ) {
            const cueText = track.activeCues[0].text;
            speakSubtitle(cueText);
            break;
          }
        }
      }
    }

    // Override the built-in method to create the button's DOM element
    createEl() {
      // Crear el elemento base con la clase correcta
      const el = super.createEl("button", {
        className: "vjs-tts-button vjs-control vjs-button",
      });

      // Establecer contenido HTML con el SVG mejorado
      el.innerHTML = `
                <span aria-hidden="true" class="vjs-icon-placeholder" style="display: flex; align-items: center; justify-content: center; height: 100%;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="100%" width="100%" fill="currentColor" style="position: relative; top: 0;">
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z"/>
                        <circle cx="18" cy="10" r="2.2" class="tts-indicator"/>
                    </svg>
                </span>
                <span class="vjs-control-text" aria-live="polite"></span>
            `;

      return el;
    }
  }

  // Register the component with VideoJS
  videojs.registerComponent("TTSButton", TTSButton);
  console.log("TTS Button component registered successfully");
}

// Export TTS functions
window.initializeTTS = initializeTTS;
window.speakSubtitle = speakSubtitle;
window.registerTTSButtonComponent = registerTTSButtonComponent;
