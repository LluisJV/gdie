// VTT loading and processing functionality

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

// Load and parse the locations VTT file
async function loadLocationsVTT() {
  if (!config.vtt.locations) {
    console.log("No hay archivo de ubicaciones disponible");
    return;
  }

  try {
    console.log(
      `Intentando cargar archivo de ubicaciones desde: ${config.vtt.locations}`
    );

    const response = await fetch(config.vtt.locations);
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
    config.segments.locations = []; // Reset the locations array

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

            config.segments.locations.push(currentSegment);
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
  let vttFile = config.vtt.explanations;

  if (!vttFile) {
    transcriptElement.textContent = "Explicación no disponible";
    return;
  }

  try {
    // Solo muestra el mensaje de carga si no hay explicaciones previas
    if (config.segments.explanations.length === 0) {
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
    config.segments.explanations = []; // Reset the segments array

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
          config.segments.explanations.push(currentSegment);
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
      `Total de segmentos encontrados: ${config.segments.explanations.length}`
    );

    // Show initial message only if there are segments and player exists
    if (config.segments.explanations.length > 0) {
      if (window.player) {
        // Si el reproductor ya está inicializado, actualiza la explicación con el tiempo actual
        updateExplanation(window.player.currentTime());
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

// Function to update the explanation based on the current video time
function updateExplanation(currentTime) {
  console.log(`updateExplanation called with currentTime: ${currentTime}`);
  const transcriptElement = document.getElementById("transcriptText");
  let currentExplanation = null;

  // Find the segment that corresponds to the current time
  for (const segment of config.segments.explanations) {
    if (currentTime >= segment.start && currentTime <= segment.end) {
      currentExplanation = segment;
      break;
    }
  }

  // Update the explanation text
  if (currentExplanation) {
    transcriptElement.innerHTML = `<div class="current-explanation">${currentExplanation.text}</div>`;
  } else if (config.segments.explanations.length > 0) {
    // Si hay segmentos pero ninguno corresponde al tiempo actual
    transcriptElement.innerHTML =
      "<div>Avanza el video para ver las explicaciones</div>";
  } else {
    // Si no hay explicaciones cargadas
    transcriptElement.innerHTML = "<div>No hay explicaciones disponibles</div>";
  }
}

// Load and parse chapters from subtitles VTT file
async function loadChaptersVTT() {
  if (!config.vtt.subtitles) {
    console.log("No hay archivo de subtítulos disponible para capítulos");
    return;
  }

  try {
    console.log(`Intentando cargar capítulos desde: ${config.vtt.subtitles}`);
    const response = await fetch(config.vtt.subtitles);
    
    if (!response.ok) {
      console.error(`Error al cargar capítulos: ${response.status} ${response.statusText}`);
      return;
    }

    const text = await response.text();
    const lines = text.split("\n");
    const chaptersList = document.getElementById("chaptersList");
    chaptersList.innerHTML = ""; // Clear loading message

    let currentChapter = null;
    const chapters = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and WEBVTT header
      if (line === "" || line === "WEBVTT") continue;

      // Skip cue numbers
      if (/^\d+$/.test(line)) continue;

      // Check if it's a timestamp line
      if (line.includes("-->")) {
        const [startTime] = line.split("-->").map(t => t.trim());
        const startSeconds = timeToSeconds(startTime);

        // The next line should contain the chapter title
        if (i + 1 < lines.length) {
          const title = lines[i + 1].trim();
          if (title && !title.includes("-->") && !/^\d+$/.test(title)) {
            currentChapter = {
              start: startSeconds,
              title: title
            };
            chapters.push(currentChapter);
          }
        }
      }
    }

    // Sort chapters by time
    chapters.sort((a, b) => a.start - b.start);

    // Create chapter elements
    if (chapters.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "chapters-list";

      chapters.forEach(chapter => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        
        button.className = "chapter-button";
        button.textContent = chapter.title;
        button.onclick = () => {
          if (window.player) {
            window.player.currentTime(chapter.start);
            window.player.play();
          }
        };

        // Add time display
        const timeSpan = document.createElement("span");
        timeSpan.className = "chapter-time";
        timeSpan.textContent = formatTime(chapter.start);
        
        li.appendChild(button);
        li.appendChild(timeSpan);
        ul.appendChild(li);
      });

      chaptersList.appendChild(ul);
    } else {
      chaptersList.textContent = "No se encontraron capítulos en el archivo";
    }

  } catch (error) {
    console.error(`Error al cargar capítulos: ${error.message}`);
    document.getElementById("chaptersList").textContent = 
      "Error al cargar los capítulos";
  }
}

// Helper function to format seconds to HH:MM:SS
function formatTime(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8).replace(/^00:/, '');
}


// Export VTT functions
window.timeToSeconds = timeToSeconds;
window.loadLocationsVTT = loadLocationsVTT;
window.loadVTTContent = loadVTTContent;
window.updateExplanation = updateExplanation;

window.loadChaptersVTT = loadChaptersVTT;
