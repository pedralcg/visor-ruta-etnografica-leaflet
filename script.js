console.log("Cargando visor Leaflet...");

// === 1. Inicializar el mapa centrado en Murcia con zoom 10 ===
const murciaCoords = [37.992240, -1.130654]; // Centro aproximado de Murcia
const map = L.map("map").setView(murciaCoords, 10);

// Corregir estilo del panel lateral tras cambios de tamaño (como al abrir consola)
function ajustarPanelCapas() {
  const panelForm = document.querySelector('.leaflet-panel-layers-list');
  if (panelForm) {
    panelForm.style.height = 'auto';
  }
  map.invalidateSize();
}

// Usar requestAnimationFrame encadenado para reducir parpadeos
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (resizeTimer) cancelAnimationFrame(resizeTimer);
  resizeTimer = requestAnimationFrame(() => {
    ajustarPanelCapas();
    resizeTimer = null;
  });
});

// === 2. Capas base ===
const capaOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© OpenStreetMap contributors'
});

const capaPNOA = L.tileLayer.wms("https://www.ign.es/wms-inspire/pnoa-ma?", {
  layers: "OI.OrthoimageCoverage",
  format: "image/jpeg",
  transparent: false,
  attribution: "PNOA &copy; IGN España",
  tiled: true,
  crs: L.CRS.EPSG3857
});

// Añadir por defecto la capa OSM
capaOSM.addTo(map);

// === 3. Variables globales para capas ===
let capaRuta, capaPuntos;

// === 4. Cargar la capa de la ruta ===
fetch("data/Ruta_Fundiciones.geojson")
  .then(res => res.json())
  .then(dataRuta => {
    capaRuta = L.geoJSON(dataRuta, {
      style: {
        color: "#ba3b0a",
        weight: 4,
        opacity: 0.8
      }
    }).addTo(map);

    //!Comprobaciones de que la ruta esté bien cargada
    console.log("Capa ruta cargada:", capaRuta);
    const layerRuta = capaRuta.getLayers()[0];
    console.log("Primer layerRuta:", layerRuta);
    console.log("layerRuta.getLatLngs():", layerRuta.getLatLngs());

    // Ahora que capaRuta existe, obtenemos los bounds y ajustamos estilo
    const rutaBounds = capaRuta.getBounds();

    // Estilo fino para animación inicial
    capaRuta.setStyle({ weight: 1 });

    // === 5. Cargar puntos de interés ===
    return fetch("data/Puntos_interes.geojson").then(res => {
      if (!res.ok) throw new Error("Error al cargar puntos.json");
      return res.json();
    }).then(dataPuntos => {
      capaPuntos = L.geoJSON(dataPuntos, {
        pointToLayer: (feature, latlng) => {
          // Marker normal
          const marker = L.marker(latlng);

          // DivIcon para título
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

          // Construir galería con miniaturas
          const galeriaHTML = imagenes.length > 0
            ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:0.5rem;">
                ${imagenes.map((ruta, idx) => `
                  <a href="${ruta}" class="glightbox" data-gallery="gallery-${feature.properties.id}" data-title="${nombre} - imagen ${idx + 1}">
                    <img src="${ruta}" alt="${nombre} - imagen ${idx + 1}" style="width:80px; height:auto; border-radius:6px; object-fit:cover;" />
                  </a>
                `).join('')}
              </div>`
            : "";

          const html = `
            <h3>${nombre}</h3>
            <p>${descripcion}</p>
            ${galeriaHTML}
            ${url ? `<p><a href="${url}" target="_blank" rel="noopener noreferrer">Más información - enlace web</a></p>` : ""}
          `;

          layer.bindPopup(html);
        }
      }).addTo(map);

      // Añadir etiquetas al mapa (títulos)
      dataPuntos.features.forEach(feature => {
        if (feature._titleMarker) {
          feature._titleMarker.addTo(map);
        }
      });

      // === 6. Control de capas ===
      const panelCapas = new L.Control.PanelLayers(
        [ // Capas base
          {
            group: "Mapas base",
            layers: [
              { name: "OpenStreetMap", layer: capaOSM, active: true },
              { name: "Ortofotos PNOA (IGN)", layer: capaPNOA }
            ]
          }
        ],
        [ // Capas superpuestas
          {
            group: "Ruta Fundiciones",
            layers: [
              {
                name: `<div style="display:flex; align-items:center; gap:6px;">
                        <div class="legend-point"></div>
                        <span>Puntos de Interés</span>
                      </div>`,
                layer: capaPuntos,
                active: true
              },
              {
                name: `<div style="display:flex; align-items:center; gap:6px;">
                        <div class="legend-line"></div>
                        <span>Ruta</span>
                      </div>`,
                layer: capaRuta,
                active: true
              }
            ]
          }
        ],
        {
          compact: false,
          collapsed: false,
          position: "topright",
        }
      );

      map.addControl(panelCapas);

      // === 7. Desplazamiento animado hacia la ruta ===
      map.flyToBounds(rutaBounds, {
        duration: 4,
        easeLinearity: 0.5,
        padding: [50, 50]  // px extra alrededor
      });

      // Restaurar grosor después de la animación
      map.once("moveend", () => {
        capaRuta.setStyle({ weight: 4 });
      });

      // === 8. Inicializar GLightbox al abrir popup ===
      let lightbox = null;
      map.on("popupopen", function () {
        if (lightbox) lightbox.destroy();
        lightbox = GLightbox({
          selector: ".glightbox",
          touchNavigation: true,
          loop: false,
          zoomable: true
        });
      });
    });
  })
  .catch(err => console.error("Error al cargar ruta o puntos:", err));

// === 10. Titulo y Marca de Agua ===
const infoMarcaAgua = {
  autorRuta: "Pedro Alcobas",
  autorVisor: '<a href="mailto:pedralcg.dev@gmail.com">pedralcg</a>',
  fuente: `<a href="https://www.ign.es" target="_blank" rel="noopener noreferrer">© IGN España</a> /
           <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>`,
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

// === 11. Control de escala (dinámico) ===
L.control.scale({
  position: 'bottomleft',
  imperial: false,
  maxWidth: 300
}).addTo(map);
