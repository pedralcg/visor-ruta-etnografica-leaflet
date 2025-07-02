console.log("Cargando visor Leaflet...");

// === 1. Inicializar el mapa centrado en Murcia con zoom 10 ===
const murciaCoords = [37.992240, -1.130654];
const map = L.map("map").setView(murciaCoords, 10);

// === 2. Corrección de estilo del panel lateral tras redimensionar ===
function ajustarPanelCapas() {
const panelForm = document.querySelector('.leaflet-panel-layers-list');
if (panelForm) {
panelForm.style.height = 'auto';
}
map.invalidateSize();
}

let resizeTimer = null;
window.addEventListener('resize', () => {
if (resizeTimer) cancelAnimationFrame(resizeTimer);
resizeTimer = requestAnimationFrame(() => {
ajustarPanelCapas();
resizeTimer = null;
});
});

// === 3. Capas base ===
const capaOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
attribution: '© OpenStreetMap contributors'
}).addTo(map);

const capaPNOA = L.tileLayer.wms("https://www.ign.es/wms-inspire/pnoa-ma?", {
layers: "OI.OrthoimageCoverage",
format: "image/jpeg",
transparent: false,
attribution: "PNOA © IGN España",
tiled: true,
crs: L.CRS.EPSG3857
});

const CartoDB_Positron = L.tileLayer.provider('CartoDB.Positron');
const Esri_WorldStreetMap = L.tileLayer.provider('Esri.WorldStreetMap');
const Esri_WorldImagery = L.tileLayer.provider('Esri.WorldImagery');
const Esri_WorldTopoMap = L.tileLayer.provider('Esri.WorldTopoMap');
const OpenTopoMap = L.tileLayer.provider('OpenTopoMap');

// === 4. Variables globales ===
let capaRuta, capaPuntos;

// === 5. Cargar capa de ruta ===
fetch("data/Ruta_Fundiciones.geojson")
.then(res => res.json())
.then(dataRuta => {
capaRuta = L.geoJSON(dataRuta, {
style: { color: "#ba3b0a", weight: 4, opacity: 0.8 }
}).addTo(map);

const layerRuta = capaRuta.getLayers()[0];
const rutaBounds = capaRuta.getBounds();
capaRuta.setStyle({ weight: 1 });

// === 6. Cargar puntos de interés ===
return fetch("data/Puntos_interes.geojson")
  .then(res => res.json())
  .then(dataPuntos => {
    capaPuntos = L.geoJSON(dataPuntos, {
      pointToLayer: (feature, latlng) => {
        const marker = L.marker(latlng);
        const nombre = feature.properties.nombre || "";
        const titleIcon = L.divIcon({
          className: 'titulo-punto',
          html: `<span>${nombre}</span>`,
          iconSize: [100, 20],
          iconAnchor: [50, -10]
        });
        const titleMarker = L.marker(latlng, {
          icon: titleIcon,
          interactive: false
        });
        feature._titleMarker = titleMarker;
        return marker;
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const nombre = props.nombre || "";
        const descripcion = props.descripcion || "";
        const url = props.url || "";
        const imagenes = props.imagen ? props.imagen.split(";").map(s => s.trim()) : [];

        const galeriaHTML = imagenes.length > 0 ?
          `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:0.5rem;">
            ${imagenes.map((ruta, idx) => `
              <a href="${ruta}" class="glightbox" data-gallery="gallery-${feature.properties.id}" data-title="${nombre} - imagen ${idx + 1}">
                <img src="${ruta}" alt="${nombre} - imagen ${idx + 1}" style="width:80px; height:auto; border-radius:6px; object-fit:cover;" />
              </a>
            `).join('')}
          </div>` : "";

        const html = `
          <h3>${nombre}</h3>
          <p>${descripcion}</p>
          ${galeriaHTML}
          ${url ? `<p><a href="${url}" target="_blank" rel="noopener noreferrer">Más información - enlace web</a></p>` : ""}
        `;

        layer.bindPopup(html);
      }
    }).addTo(map);

    dataPuntos.features.forEach(feature => {
      if (feature._titleMarker) feature._titleMarker.addTo(capaPuntos);
    });

    // === 7. Mostrar tiempo actual (en modal) ===
    const openWeatherApiKey = "72876c35aad782ddde488847f389ff34";

    async function mostrarTiempoEnCentro() {
      const center = map.getCenter();
      const lat = center.lat;
      const lon = center.lng;
      try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${openWeatherApiKey}`);
        if (!response.ok) throw new Error("Error al obtener datos del tiempo");
        const data = await response.json();

        const ciudad = data.name;
        const temp = data.main.temp.toFixed(1);
        const temp_min = data.main.temp_min.toFixed(1);
        const temp_max = data.main.temp_max.toFixed(1);
        const humedad = data.main.humidity;
        const viento = (data.wind.speed * 3.6).toFixed(1);
        const descripcion = data.weather[0].description;
        const icon = data.weather[0].icon;
        const fechaHora = new Date().toLocaleString("es-ES");

        const contenidoDiv = document.getElementById("contenido-pronostico");
        const modal = document.getElementById("modal-pronostico");

        if (contenidoDiv && modal) {
          contenidoDiv.innerHTML = `
            <h2 style="margin-top:0; font-size:18px;">📍 Tiempo actual</h2>
            <p><strong>Ubicación:</strong> ${ciudad}</p>
            <div class="franja-pronostico">
              <div><strong>${fechaHora}</strong></div>
              <div><img src="https://openweathermap.org/img/wn/${icon}.png" alt="${descripcion}" title="${descripcion}" /></div>
              <div>${descripcion}</div>
              <div>🌡️ Temperatura: ${temp}°C</div>
              <div>🌡️ Mín: ${temp_min}°C / Máx: ${temp_max}°C</div>
              <div>💧 Humedad: ${humedad}%</div>
              <div>💨 Viento: ${viento} km/h</div>
            </div>
          `;
          modal.classList.remove("hidden");
        }

      } catch (error) {
        console.error("Error obteniendo el tiempo actual:", error);
        alert("No se pudo obtener el tiempo actual.");
      }
    }

    // --- Mostrar pronóstico 5 días en modal ---
    async function mostrarPronosticoProximo() {
      const center = map.getCenter();
      const lat = center.lat;
      const lon = center.lng;

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${openWeatherApiKey}`
        );
        if (!response.ok) throw new Error("Error al obtener el pronóstico");

        const data = await response.json();
        const ciudad = data.city.name;

        // === Agrupar datos por día ===
        const pronosticoPorDia = {}; // { "2025-07-01": [bloque1, bloque2, ...] }

        data.list.forEach(bloque => {
          const fecha = new Date(bloque.dt * 1000);
          const dia = fecha.toISOString().split("T")[0];

          if (!pronosticoPorDia[dia]) pronosticoPorDia[dia] = [];
          pronosticoPorDia[dia].push(bloque);
        });

        const tabsContainer = document.createElement("div");
        tabsContainer.className = "tabs-pronostico";

        const contenidoDiaContainer = document.createElement("div");
        contenidoDiaContainer.className = "contenido-dia";

        // === Función para renderizar contenido del día ===
        const renderContenidoDia = (bloques) => {
          contenidoDiaContainer.innerHTML = bloques.map(bloque => {
            const fecha = new Date(bloque.dt * 1000);
            const horaStr = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

            let icon = bloque.weather[0].icon;
            if (fecha.getHours() < 6 || fecha.getHours() >= 20) icon = icon.replace("d", "n");

            // Extraer datos
            const desc = bloque.weather[0].description;
            const temp = bloque.main.temp.toFixed(1);
            const feels_like = bloque.main.feels_like.toFixed(1);
            const viento = (bloque.wind.speed * 3.6).toFixed(0);
            const pop = bloque.pop !== undefined ? (bloque.pop * 100).toFixed(0) : null; // probabilidad de precipitación en %

            return `
              <div class="franja-pronostico">
                <div><strong>${horaStr}</strong></div>
                <div><img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" title="${desc}" /></div>
                <div>${desc}</div>
                <div>🌡️ Temperatura media: ${temp}°C</div>
                <div>🤒 Sensación térmica: ${feels_like}°C</div>
                <div>💨 Viento: ${viento} km/h</div>
                <div>☔️ Probabilidad precipitación: ${pop !== null ? pop + "%" : "N/A"}</div>
              </div>
            `;
          }).join("");
        };

        const dias = Object.entries(pronosticoPorDia).slice(0, 5);

        dias.forEach(([fechaISO, bloques], index) => {
          const fecha = new Date(fechaISO);
          const diaLabel = fecha.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

          const tab = document.createElement("button");
          tab.textContent = diaLabel;

          if (index === 0) tab.classList.add("active");

          tab.addEventListener("click", () => {
            document.querySelectorAll(".tabs-pronostico button").forEach(b => b.classList.remove("active"));
            tab.classList.add("active");
            renderContenidoDia(bloques);
          });

          tabsContainer.appendChild(tab);

          // Mostrar el primer día por defecto
          if (index === 0) renderContenidoDia(bloques);
        });

        const modal = document.getElementById("modal-pronostico");
        const modalContent = modal.querySelector(".modal-content");

        modal.addEventListener("click", (e) => {
          if (e.target === modal) {  // Si clicaste en el fondo (el modal contenedor)
            modal.classList.add("hidden");
          }
        });
        
        const contenidoDiv = document.getElementById("contenido-pronostico");

        if (modal && contenidoDiv) {
          contenidoDiv.innerHTML = `
            <h2 style="margin-top:0; font-size:18px;">🔮 Pronóstico 5 días</h2>
            <p style="margin-bottom:10px;"><strong>Ubicación:</strong> ${ciudad}</p>
          `;
          contenidoDiv.appendChild(tabsContainer);
          contenidoDiv.appendChild(contenidoDiaContainer);
          modal.classList.remove("hidden");
        }

      } catch (error) {
        console.error("Error al obtener pronóstico:", error);
        alert("No se pudo obtener el pronóstico.");
      }
    }

    // Botón cerrar modal
    document.getElementById("cerrar-modal-pronostico")?.addEventListener("click", () => {
      document.getElementById("modal-pronostico")?.classList.add("hidden");
    });



    // === 8. Botón personalizado dentro del panel de capas ===
    function insertarBotonesClima() {
      const panel = document.querySelector(".leaflet-control-layers-expanded");
      if (!panel) {
        console.warn("❌ No se encontró el contenedor del panel de capas");
        return;
      }

      // Evitar crear duplicados
      if (document.getElementById("btn-tiempo-container")) return;

      // Crear contenedor para los dos botones
      const contenedor = document.createElement("div");
      contenedor.id = "btn-tiempo-container";
      contenedor.style.marginTop = "10px";
      contenedor.style.display = "flex";
      contenedor.style.flexDirection = "column";
      contenedor.style.gap = "6px";

      // Botón tiempo actual
      const btnTiempo = document.createElement("button");
      btnTiempo.id = "btn-tiempo";
      btnTiempo.textContent = "📍 Ver tiempo actual";
      btnTiempo.className = "btn-clima"; // Clase CSS para estilos comunes
      btnTiempo.addEventListener("click", mostrarTiempoEnCentro);

      // Botón pronóstico 5 días
      const btnPronostico = document.createElement("button");
      btnPronostico.id = "btn-pronostico";
      btnPronostico.textContent = "🔮 Pronóstico 5 días";
      btnPronostico.className = "btn-clima"; // Clase CSS para estilos comunes
      btnPronostico.addEventListener("click", mostrarPronosticoProximo);

      contenedor.appendChild(btnTiempo);
      contenedor.appendChild(btnPronostico);
      panel.appendChild(contenedor);
    }

    // Llamar solo una vez después de crear el control de capas (o con un pequeño delay)
    setTimeout(() => {
      insertarBotonesClima();
    }, 1);


    // === 9. Árbol de capas ===
    const baseMapsTree = {
      label: "🗺️ Mapas base",
      children: [
        { label: "OpenStreetMap", layer: capaOSM },
        { label: "Ortofotos PNOA (IGN)", layer: capaPNOA },
        { label: "CartoDB Positron", layer: CartoDB_Positron },
        { label: "Esri World Street Map", layer: Esri_WorldStreetMap },
        { label: "Esri World Imagery", layer: Esri_WorldImagery },
        { label: "Esri World Topo Map", layer: Esri_WorldTopoMap },
        { label: "OpenTopoMap", layer: OpenTopoMap }
      ]
    };

    const baseCartoTree = { label: "🌐 Base cartográfica", children: [baseMapsTree] };
    const overlayTree = {
      label: "🗂️ Coberturas de ruta",
      children: [
        { label: "Puntos de Interés", layer: capaPuntos },
        { label: "Ruta", layer: capaRuta }
      ]
    };

    L.control.layers.tree(baseCartoTree, overlayTree, {
      collapsed: false,
      namedToggle: true,
      selectorBack: true,
      position: 'topright'
    }).addTo(map);

    // === 10. Reordenar el panel de capas (superpuestas arriba) ===
    setTimeout(() => {
      try {
        const panelList = document.querySelector('.leaflet-control-layers-list');
        const baseGroup = document.querySelector('.leaflet-control-layers-base');
        const overlaysGroup = document.querySelector('.leaflet-control-layers-overlays');
        const separator = document.querySelector('.leaflet-control-layers-separator');

        if (!panelList || !baseGroup || !overlaysGroup || !separator) {
          console.warn('No se encontraron todos los elementos necesarios para reordenar el panel de capas.');
          return;
        }

        panelList.insertBefore(overlaysGroup, baseGroup);
        panelList.insertBefore(separator, baseGroup);
        // console.log('✅ Panel de capas reordenado: superpuestas arriba, base abajo.');
      } catch (error) {
        console.warn('⚠️ No se pudo reordenar el panel de capas:', error);
      }
    }, 1);

    // === 11. Insertar iconos en etiquetas de leyenda ===
    function insertarIconosLeyenda() {
      const labels = document.querySelectorAll('.leaflet-layerstree-header-label');
      if (labels.length === 0) {
        setTimeout(insertarIconosLeyenda, 200);
        return;
      }
      labels.forEach(label => {
        const spanNombre = label.querySelector('.leaflet-layerstree-header-name');
        if (!spanNombre) return;
        const texto = spanNombre.textContent.trim();
        if (texto.includes("Ruta") && !label.querySelector('.legend-line')) {
          const icon = document.createElement("span");
          icon.className = "legend-line";
          label.insertBefore(icon, spanNombre);
        }
        if (texto.includes("Puntos de Interés") && !label.querySelector('.legend-point')) {
          const icon = document.createElement("span");
          icon.className = "legend-point";
          label.insertBefore(icon, spanNombre);
        }
      });
    }
    insertarIconosLeyenda();

    // === 12. Desplazamiento animado ===
    map.flyToBounds(rutaBounds, { duration: 4, easeLinearity: 0.5, padding: [50, 50] });
    map.once("moveend", () => { capaRuta.setStyle({ weight: 4 }); });

    // === 13. Inicializar GLightbox ===
    let lightbox = null;
    map.on("popupopen", () => {
      if (lightbox) lightbox.destroy();
      lightbox = GLightbox({ selector: ".glightbox", touchNavigation: true, loop: false, zoomable: true });
    });
  });

})
.catch(err => console.error("Error al cargar ruta o puntos:", err));

// === 14. Titulo y Marca de Agua ===
const infoMarcaAgua = {
  autorRuta: "Pedro Alcobas",
  autorVisor: '<a href="mailto:pedralcg.dev@gmail.com">pedralcg</a>',
  fuente: `<a href="https://www.ign.es" target="_blank" rel="noopener noreferrer">© IGN España</a> /
           <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>`,
  fuenteClima: `<a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">© OpenWeather</a>`,
  web: '<a href="https://pedralcg.github.io/" target="_blank" rel="noopener noreferrer">Web</a>',
  repo: '<a href="https://github.com/pedralcg/visor-ruta-etnografica-leaflet" target="_blank" rel="noopener noreferrer">GitHub</a>',
  licenciaCodigo: '<a href="https://opensource.org/licenses/MIT" target="_blank">MIT</a>',
  licenciaContenidos: 'Todos los derechos reservados (textos e imágenes)'
};

const infoTitulo = {
  titulo: "Visor Etnográfico para rutas culturales",
  subtitulo: "Ruta de las Fundiciones (La Unión)",
  paradas: 12,
  longitud: "14,5 km",
  duracion: "4 h",
  desnivel: "300 m"
};

function actualizarMarcaAgua(info) {
  let marca = document.getElementById('marca-agua');
  if (!marca) {
    marca = document.createElement('div');
    marca.id = 'marca-agua';
    document.body.appendChild(marca);
  }
  marca.innerHTML = `
    <strong>Ruta y contenidos:</strong> ${info.autorRuta}<br>
    <strong>Desarrollado por:</strong> ${info.autorVisor} · ${info.web} · ${info.repo}<br>
    <strong>Fuente cartográfica:</strong> ${info.fuente}<br>
    <strong>Fuente climática:</strong> ${info.fuenteClima}<br>
    <strong>Licencia del visor (código):</strong> ${info.licenciaCodigo}<br>
    <strong>Licencia de los contenidos:</strong> ${info.licenciaContenidos}
  `;
}

function actualizarTitulo(info) {
  let tituloDiv = document.getElementById('titulo-ruta');
  if (!tituloDiv) {
    tituloDiv = document.createElement('div');
    tituloDiv.id = 'titulo-ruta';
    document.body.appendChild(tituloDiv);
  }
  tituloDiv.innerHTML = `
    <h1 style="margin: 0; font-size: 20px;">${info.titulo}</h1>
    <h2 style="margin: 0; font-size: 18px;">${info.subtitulo}</h2>
    <div style="font-size: 14px; margin-top: 4px;">
      Paradas: ${info.paradas} | Longitud total: ${info.longitud}<br>
      Duración estimada: ${info.duracion} | Desnivel: ${info.desnivel}
    </div>
  `;
}

actualizarMarcaAgua(infoMarcaAgua);
actualizarTitulo(infoTitulo);

// === 15. Control de escala (dinámico) ===
L.control.scale({
  position: 'bottomleft',
  imperial: false,
  maxWidth: 300
}).addTo(map);
