(function () {
  'use strict';

  // === Utilidades ===
  const escapeHTML = (s = '') =>
    String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

  let _notifTimer = null;
  function mostrarNotificacion(msg, duration = 4000) {
    const el = document.getElementById('notificacion');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(_notifTimer);
    _notifTimer = setTimeout(() => { el.style.display = 'none'; }, duration);
  }

  // === Año dinámico ===
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

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
  // Nota: el redibujo del perfil de elevación en resize se gestiona en la sección 12.

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

  const CartoDB_Positron    = L.tileLayer.provider('CartoDB.Positron');
  const Esri_WorldStreetMap = L.tileLayer.provider('Esri.WorldStreetMap');
  const Esri_WorldImagery   = L.tileLayer.provider('Esri.WorldImagery');
  const Esri_WorldTopoMap   = L.tileLayer.provider('Esri.WorldTopoMap');
  const OpenTopoMap         = L.tileLayer.provider('OpenTopoMap');

  // === 4. Variables globales (inicializadas a null) ===
  let capaRuta      = null;
  let capaPuntos    = null;
  let _rutaBounds   = null;
  let _altitudes    = [];
  let _cumDist      = [];
  let _currentPct   = 0;
  let _gpxBlobUrl   = null;

  // === Interpolación para mover el marcador según slider ===
  // distancias[] y totalDist se precalculan una vez fuera del listener.
  function interpolarPosicion(coords, porcentaje, distancias, totalDist) {
    if (porcentaje <= 0) return coords[0];
    if (porcentaje >= 1) return coords[coords.length - 1];

    let distanciaRecorrida = totalDist * porcentaje;
    let acumulada = 0;

    for (let i = 0; i < distancias.length; i++) {
      if (acumulada + distancias[i] >= distanciaRecorrida) {
        const resto = distanciaRecorrida - acumulada;
        const ratio = resto / distancias[i];
        const lat = coords[i].lat + ratio * (coords[i + 1].lat - coords[i].lat);
        const lng = coords[i].lng + ratio * (coords[i + 1].lng - coords[i].lng);
        return L.latLng(lat, lng);
      }
      acumulada += distancias[i];
    }

    return coords[coords.length - 1];
  }

  /**
   * Tiempo estimado de la ruta: 4 km/h + 10 min/100m de ascenso.
   */
  function calcularTiempoRuta(distanciaKm, desnivelPositivoM) {
    const tiempoDistanciaMin = (distanciaKm / 4) * 60;
    const tiempoDesnivelMin  = (desnivelPositivoM / 100) * 10;
    let tiempoTotalMin = Math.round((tiempoDistanciaMin + tiempoDesnivelMin) / 30) * 30;

    const horas   = Math.floor(tiempoTotalMin / 60);
    const minutos = tiempoTotalMin % 60;
    let resultado = '';
    if (horas > 0)   resultado += `${horas} h`;
    if (minutos > 0) resultado += (resultado ? ' ' : '') + `${minutos} min`;
    return resultado || '0 min';
  }

  // === 5a. Perfil de elevación ===
  function dibujarPerfilElevacion(porcentaje) {
    const svg = document.getElementById('elevation-svg');
    if (!svg || _altitudes.length < 2) return;

    const W = svg.clientWidth || 600;
    const H = svg.clientHeight || 74;
    const pad = { top: 8, bottom: 18, left: 34, right: 6 };
    const iW = W - pad.left - pad.right;
    const iH = H - pad.top - pad.bottom;

    const minAlt = Math.min(..._altitudes);
    const maxAlt = Math.max(..._altitudes);
    const rng    = maxAlt - minAlt || 1;
    const total  = _cumDist[_cumDist.length - 1];

    const pts = _altitudes.map((alt, i) => {
      const x = (pad.left + (_cumDist[i] / total) * iW).toFixed(1);
      const y = (pad.top  + iH - ((alt - minAlt) / rng) * iH).toFixed(1);
      return `${x},${y}`;
    });

    const baseY  = pad.top + iH;
    const mrkX   = (pad.left + porcentaje * iW).toFixed(1);

    // Altitud interpolada en la posición actual
    const d = total * porcentaje;
    let currentAlt = _altitudes[_altitudes.length - 1];
    let acc = 0;
    for (let i = 0; i < _cumDist.length - 1; i++) {
      const seg = _cumDist[i + 1] - _cumDist[i];
      if (acc + seg >= d) {
        const ratio = seg > 0 ? (d - acc) / seg : 0;
        currentAlt = _altitudes[i] + ratio * (_altitudes[i + 1] - _altitudes[i]);
        break;
      }
      acc += seg;
    }
    const mrkY = (pad.top + iH - ((currentAlt - minAlt) / rng) * iH).toFixed(1);

    svg.innerHTML = `
      <defs>
        <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c9882a" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#c9882a" stop-opacity="0.04"/>
        </linearGradient>
      </defs>
      <path d="M${pad.left},${baseY} L${pts.join(' L')} L${(pad.left + iW).toFixed(1)},${baseY} Z" fill="url(#eg)"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="#c9882a" stroke-width="1.5" stroke-linejoin="round"/>
      <text x="${pad.left - 2}" y="${pad.top + 5}" text-anchor="end" font-size="9" fill="#445044">${Math.round(maxAlt)}m</text>
      <text x="${pad.left - 2}" y="${baseY}" text-anchor="end" font-size="9" fill="#445044">${Math.round(minAlt)}m</text>
      <line x1="${mrkX}" y1="${pad.top}" x2="${mrkX}" y2="${baseY}" stroke="#1e5c2e" stroke-width="1.5" stroke-dasharray="3,2"/>
      <circle cx="${mrkX}" cy="${mrkY}" r="3.5" fill="#1e5c2e" stroke="#fff" stroke-width="1"/>
    `;

    const statsEl = document.getElementById('elevation-stats');
    if (statsEl) {
      statsEl.textContent =
        `Alt. actual: ${Math.round(currentAlt)} m · Mín: ${Math.round(minAlt)} m · Máx: ${Math.round(maxAlt)} m · Desnivel: ±${Math.round(maxAlt - minAlt)} m`;
    }
  }

  // === 5b. Generar GPX ===
  function generarGPX(coords, alts) {
    const trkpts = coords.map((c, i) => {
      const ele = alts[i] != null ? `<ele>${alts[i].toFixed(1)}</ele>` : '';
      return `    <trkpt lat="${c.lat.toFixed(7)}" lon="${c.lng.toFixed(7)}">${ele}</trkpt>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="visor-ruta-etnografica-leaflet" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Ruta de las Fundiciones</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  }

  // === 5. Cargar capa de ruta y puntos ===
  async function cargarRutaYPuntos() {
    try {
      const resRuta = await fetch("data/Ruta_Fundiciones.geojson");
      if (!resRuta.ok) throw new Error(`HTTP error! status: ${resRuta.status}`);
      const dataRuta = await resRuta.json();

      if (!dataRuta.features || dataRuta.features.length === 0) {
        console.error("Error: Ruta_Fundiciones.geojson no contiene features.");
        return;
      }

      const rutaFeature    = dataRuta.features[0];
      const rutaProperties = rutaFeature.properties;

      capaRuta = L.geoJSON(dataRuta, {
        style: { color: "#ba3b0a", weight: 4, opacity: 0.8 }
      }).addTo(map);

      let rutaCoords = capaRuta.getLayers()[0].getLatLngs();
      if (rutaCoords.length > 0 && Array.isArray(rutaCoords[0]) && Array.isArray(rutaCoords[0][0])) {
        rutaCoords = rutaCoords.flat();
      } else if (rutaCoords.length > 0 && Array.isArray(rutaCoords[0]) && !(rutaCoords[0] instanceof L.LatLng)) {
        rutaCoords = rutaCoords.flat();
      }

      // Precalcular segmentos una sola vez para el slider
      const rutaDistancias = [];
      let totalRouteLengthMeters = 0;
      for (let i = 0; i < rutaCoords.length - 1; i++) {
        const d = rutaCoords[i].distanceTo(rutaCoords[i + 1]);
        rutaDistancias.push(d);
        totalRouteLengthMeters += d;
      }
      const totalRouteLengthKm = totalRouteLengthMeters / 1000;

      // Altitudes y distancias acumuladas para perfil de elevación
      _altitudes = rutaCoords.map(c => c.alt || 0);
      _cumDist   = [0];
      for (let i = 0; i < rutaDistancias.length; i++) {
        _cumDist.push(_cumDist[i] + rutaDistancias[i]);
      }
      _rutaBounds = capaRuta.getBounds();

      const resPuntos = await fetch("data/Puntos_interes.geojson");
      if (!resPuntos.ok) throw new Error(`HTTP error! status: ${resPuntos.status}`);
      const dataPuntos = await resPuntos.json();

      if (!dataPuntos.features) {
        console.error("Error: Puntos_interes.geojson no contiene features.");
      }

      // === Título dinámico ===
      const desnivelPositivoM  = parseFloat(rutaProperties.desnivel) || 0;
      const duracionCalculada  = calcularTiempoRuta(totalRouteLengthKm, desnivelPositivoM);

      const infoTitulo = {
        titulo:   rutaProperties.name     || "Visor Etnográfico",
        subtitulo: rutaProperties.subtitulo || "Ruta Cultural",
        duracion: duracionCalculada,
        desnivel: rutaProperties.desnivel ? `${rutaProperties.desnivel} m` : "N/A metros",
        paradas:  dataPuntos.features ? dataPuntos.features.length : 0
      };

      let tituloDiv = document.getElementById('titulo-ruta');
      if (!tituloDiv) {
        tituloDiv = document.createElement('div');
        tituloDiv.id = 'titulo-ruta';
        document.body.appendChild(tituloDiv);
      }
      tituloDiv.innerHTML = `
        <h1 style="margin: 0; font-size: 18px;">${escapeHTML(infoTitulo.titulo)}</h1>
        <h2 style="margin: 0; font-size: 15px; font-weight: 600;">${escapeHTML(infoTitulo.subtitulo)}</h2>
        <div style="font-size: 13px; margin-top: 4px;">
          Paradas: ${infoTitulo.paradas} | Longitud total: ${totalRouteLengthKm.toFixed(1).replace('.', ',')} km<br>
          Duración estimada: ${infoTitulo.duracion} | Desnivel: ${escapeHTML(infoTitulo.desnivel)}
        </div>
      `;

      // === Animación al cargar ===
      const rutaBounds = capaRuta.getBounds();
      capaRuta.setStyle({ weight: 1 });
      map.flyToBounds(rutaBounds, {
        paddingTopLeft: [100, 50],
        paddingBottomRight: [100, 50],
        duration: 4,
        easeLinearity: 0.5,
      });
      map.once("moveend", () => { capaRuta.setStyle({ weight: 4 }); });

      // === Marcador de posición en ruta ===
      const iconoMarcador = L.icon({
        iconUrl: "assets/img/marcador-ruta.png",
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -55],
        className: 'leaflet-marker-icon-ruta'
      });

      if (rutaCoords.length > 0) {
        const marcadorInicialPct = 0.004;
        const marcador = L.marker(
          interpolarPosicion(rutaCoords, marcadorInicialPct, rutaDistancias, totalRouteLengthMeters),
          { icon: iconoMarcador }
        ).addTo(map);
        marcador.bindPopup("🚶 Posición actual en la ruta");

        const sliderValueSpan  = document.getElementById("slider-value");
        const totalKmFormatted = totalRouteLengthKm.toFixed(1).replace('.', ',');

        // Función central: actualiza marcador + texto de km + perfil
        function actualizarPosicion(pct) {
          _currentPct = pct;
          marcador.setLatLng(interpolarPosicion(rutaCoords, pct, rutaDistancias, totalRouteLengthMeters));
          if (sliderValueSpan) {
            const km = (totalRouteLengthMeters * pct / 1000).toFixed(1);
            sliderValueSpan.textContent = `${km.replace('.', ',')} km / ${totalKmFormatted} km`;
          }
          dibujarPerfilElevacion(pct);
        }

        // Posición inicial
        actualizarPosicion(marcadorInicialPct);

        // GPX: generar blob y asignar al botón de descarga
        _gpxBlobUrl = URL.createObjectURL(
          new Blob([generarGPX(rutaCoords, _altitudes)], { type: 'application/gpx+xml' })
        );
        const gpxEl = document.getElementById('btn-descargar-gpx');
        if (gpxEl) gpxEl.href = _gpxBlobUrl;

        // Perfil de elevación como slider (click + drag)
        const svgEl = document.getElementById('elevation-svg');
        if (svgEl) {
          let _isDragging = false;
          const getPct = (e) => {
            const rect = svgEl.getBoundingClientRect();
            const iW = rect.width - 34 - 6; // pad.left - pad.right
            return Math.min(1, Math.max(0, (e.clientX - rect.left - 34) / iW));
          };
          svgEl.addEventListener('pointerdown', (e) => {
            _isDragging = true;
            svgEl.setPointerCapture(e.pointerId);
            actualizarPosicion(getPct(e));
          });
          svgEl.addEventListener('pointermove', (e) => {
            if (_isDragging) actualizarPosicion(getPct(e));
          });
          svgEl.addEventListener('pointerup',     () => { _isDragging = false; });
          svgEl.addEventListener('pointercancel', () => { _isDragging = false; });
          L.DomEvent.disableScrollPropagation(svgEl);
        }
      } else {
        console.warn("No se encontraron coordenadas en la ruta para el marcador.");
      }

      // === Icono para Puntos de Interés ===
      const iconoPuntoInteres = L.icon({
        iconUrl: "assets/img/marcador-puntos.png",
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -45],
        className: 'leaflet-marker-icon-puntos'
      });

      // === 6. Cargar puntos de interés ===
      const IMAGES_BASE_PATH = 'assets/img/';

      capaPuntos = L.geoJSON(dataPuntos, {
        pointToLayer: (feature, latlng) => {
          const marker = L.marker(latlng, { icon: iconoPuntoInteres });
          const nombre = feature.properties.nombre || "";
          const titleIcon = L.divIcon({
            className: 'titulo-punto',
            html: `<span>${nombre}</span>`,
            iconSize: [100, 20],
            iconAnchor: [50, -10]
          });
          const titleMarker = L.marker(latlng, { icon: titleIcon, interactive: false });
          marker._titleMarker = titleMarker; // en el layer, no en el feature
          return marker;
        },
        onEachFeature: (feature, layer) => {
          const props       = feature.properties;
          const nombre      = props.nombre      || "";
          const descripcion = props.descripcion || "";
          const url         = props.url         || "";
          const categoria   = props.categoria   || "";

          const imagenesRelativas = props.imagen
            ? props.imagen.split(";").map(s => s.trim())
            : [];

          const galeriaHTML = imagenesRelativas.length > 0 ? `
            <div class="popup-galeria">
              ${imagenesRelativas.map((rutaRelativa, idx) => {
                const rutaCompleta = IMAGES_BASE_PATH + rutaRelativa;
                return `
                  <a href="${rutaCompleta}" class="glightbox"
                     data-gallery="gallery-${escapeHTML(String(feature.properties.id))}"
                     data-title="${escapeHTML(nombre)} - imagen ${idx + 1}">
                    <img src="${rutaCompleta}"
                         class="popup-galeria-img"
                         alt="${escapeHTML(nombre)} - imagen ${idx + 1}" />
                  </a>
                `;
              }).join('')}
            </div>` : "";

          const html = `
            <h3>${nombre}</h3>
            <p>${descripcion}</p>
            ${galeriaHTML}
            ${url ? `<p><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(categoria)}</a></p>` : ""}
          `;

          layer.bindPopup(html);
        }
      }).addTo(map);

      capaPuntos.eachLayer(layer => {
        if (layer._titleMarker) {
          layer._titleMarker.addTo(map); // al map, no a capaPuntos
        }
      });

      // === Control de capas ===
      const baseMapsTree = {
        label: "🗺️ Mapas base",
        children: [
          { label: "OpenStreetMap",          layer: capaOSM },
          { label: "Ortofotos PNOA (IGN)",   layer: capaPNOA },
          { label: "CartoDB Positron",        layer: CartoDB_Positron },
          { label: "Esri World Street Map",  layer: Esri_WorldStreetMap },
          { label: "Esri World Imagery",     layer: Esri_WorldImagery },
          { label: "Esri World Topo Map",    layer: Esri_WorldTopoMap },
          { label: "OpenTopoMap",            layer: OpenTopoMap }
        ]
      };

      const baseCartoTree = { label: "🌐 Base cartográfica", children: [baseMapsTree] };
      const overlayTree = {
        label: "🗂️ Coberturas de ruta",
        children: [
          { label: "Puntos de Interés", layer: capaPuntos },
          { label: "Ruta",              layer: capaRuta }
        ]
      };

      L.control.layers.tree(baseCartoTree, overlayTree, {
        collapsed: false,
        namedToggle: true,
        selectorBack: true,
        position: 'topright'
      }).addTo(map);

      insertarBotonesClima();
      insertarBotonesRuta();
      insertarIconosLeyenda();

      // === Reordenar panel de capas ===
      setTimeout(() => {
        try {
          const panelList     = document.querySelector('.leaflet-control-layers-list');
          const baseGroup     = document.querySelector('.leaflet-control-layers-base');
          const overlaysGroup = document.querySelector('.leaflet-control-layers-overlays');
          const separator     = document.querySelector('.leaflet-control-layers-separator');
          if (panelList && baseGroup && overlaysGroup && separator) {
            panelList.insertBefore(overlaysGroup, baseGroup);
            panelList.insertBefore(separator, baseGroup);
          }
        } catch (error) {
          console.warn('No se pudo reordenar el panel de capas:', error);
        }
      }, 100);

    } catch (error) {
      console.error("Error al cargar ruta o puntos:", error);
      const tituloDiv = document.getElementById('titulo-ruta');
      if (tituloDiv) {
        tituloDiv.innerHTML = `
          <h1 style="margin: 0; font-size: 18px; color: red;">Error al cargar la ruta</h1>
          <h2 style="margin: 0; font-size: 15px; color: red;">Por favor, recarga la página.</h2>
        `;
      }
    }
  }

  cargarRutaYPuntos();

  // === 7. OpenWeatherMap ===
  // ⚠️ ADVERTENCIA: Esta clave es visible en el código fuente del cliente.
  // En un sitio estático no hay forma de ocultarla. Revoca y rota la clave si detectas uso abusivo.
  const openWeatherApiKey = "72876c35aad782ddde488847f389ff34";

  // === Modal — gestión de foco ===
  let _modalTrigger = null;

  function abrirModal() {
    _modalTrigger = document.activeElement;
    const modal = document.getElementById('modal-pronostico');
    if (!modal) return;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      document.getElementById('cerrar-modal-pronostico')?.focus();
    });
  }

  function cerrarModal() {
    const modal = document.getElementById('modal-pronostico');
    if (!modal) return;
    modal.classList.add('hidden');
    if (_modalTrigger) { _modalTrigger.focus(); _modalTrigger = null; }
  }

  document.getElementById('cerrar-modal-pronostico')?.addEventListener('click', cerrarModal);

  document.getElementById('modal-pronostico')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) cerrarModal();
  });

  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modal-pronostico');
    if (!modal || modal.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      cerrarModal();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = Array.from(
        modal.querySelector('.modal-content').querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.closest('[hidden]') && el.offsetParent !== null);

      if (focusables.length === 0) { e.preventDefault(); return; }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  });

  // === Mostrar tiempo actual ===
  async function mostrarTiempoEnCentro() {
    const center = map.getCenter();
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${center.lat}&lon=${center.lng}&units=metric&lang=es&appid=${openWeatherApiKey}`
      );
      if (!response.ok) throw new Error("Error al obtener datos del tiempo");
      const data = await response.json();

      const ciudad      = escapeHTML(data.name);
      const temp        = data.main.temp.toFixed(1);
      const temp_min    = data.main.temp_min.toFixed(1);
      const temp_max    = data.main.temp_max.toFixed(1);
      const humedad     = data.main.humidity;
      const viento      = (data.wind.speed * 3.6).toFixed(1);
      const descripcion = escapeHTML(data.weather[0].description);
      const icon        = data.weather[0].icon;
      const fechaHora   = new Date().toLocaleString("es-ES");

      const tituloEl = document.getElementById("modal-pronostico-titulo");
      const cuerpoEl = document.getElementById("cuerpo-pronostico");
      if (tituloEl && cuerpoEl) {
        tituloEl.textContent = "☀️ Tiempo actual";
        cuerpoEl.innerHTML = `
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
        abrirModal();
      }

    } catch (error) {
      console.error("Error obteniendo el tiempo actual:", error);
      mostrarNotificacion("No se pudo obtener el tiempo actual.");
    }
  }

  // === Mostrar pronóstico 5 días ===
  async function mostrarPronosticoProximo() {
    const center = map.getCenter();
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${center.lat}&lon=${center.lng}&units=metric&lang=es&appid=${openWeatherApiKey}`
      );
      if (!response.ok) throw new Error("Error al obtener el pronóstico");
      const data   = await response.json();
      const ciudad = escapeHTML(data.city.name);

      const pronosticoPorDia = {};
      data.list.forEach(bloque => {
        const fecha = new Date(bloque.dt * 1000);
        // Agrupar por fecha local (no UTC) para evitar off-by-one en UTC+1/+2
        const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
        if (!pronosticoPorDia[dia]) pronosticoPorDia[dia] = [];
        pronosticoPorDia[dia].push(bloque);
      });

      const tabsContainer        = document.createElement("div");
      tabsContainer.className    = "tabs-pronostico";
      const contenidoDiaContainer = document.createElement("div");
      contenidoDiaContainer.className = "contenido-dia";

      const renderContenidoDia = (bloques) => {
        contenidoDiaContainer.innerHTML = bloques.map(bloque => {
          const fecha    = new Date(bloque.dt * 1000);
          const horaStr  = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
          let icon       = bloque.weather[0].icon;
          if (fecha.getHours() < 6 || fecha.getHours() >= 20) icon = icon.replace("d", "n");
          const desc     = escapeHTML(bloque.weather[0].description);
          const temp     = bloque.main.temp.toFixed(1);
          const feels    = bloque.main.feels_like.toFixed(1);
          const viento   = (bloque.wind.speed * 3.6).toFixed(0);
          const pop      = bloque.pop !== undefined ? (bloque.pop * 100).toFixed(0) : null;
          return `
            <div class="franja-pronostico">
              <div><strong>${horaStr}</strong></div>
              <div><img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" title="${desc}" /></div>
              <div>${desc}</div>
              <div>🌡️ Temperatura media: ${temp}°C</div>
              <div>🤒 Sensación térmica: ${feels}°C</div>
              <div>💨 Viento: ${viento} km/h</div>
              <div>☔️ Prob. precipitación: ${pop !== null ? pop + "%" : "N/A"}</div>
            </div>
          `;
        }).join("");
      };

      Object.entries(pronosticoPorDia).slice(0, 5).forEach(([fechaISO, bloques], index) => {
        const diaLabel = new Date(fechaISO).toLocaleDateString("es-ES", {
          weekday: "short", day: "numeric", month: "short"
        });
        const tab = document.createElement("button");
        tab.textContent = diaLabel;
        if (index === 0) { tab.classList.add("active"); renderContenidoDia(bloques); }
        tab.addEventListener("click", () => {
          tabsContainer.querySelectorAll("button").forEach(b => b.classList.remove("active"));
          tab.classList.add("active");
          renderContenidoDia(bloques);
        });
        tabsContainer.appendChild(tab);
      });

      const tituloEl = document.getElementById("modal-pronostico-titulo");
      const cuerpoEl = document.getElementById("cuerpo-pronostico");
      if (tituloEl && cuerpoEl) {
        tituloEl.textContent = "📅 Pronóstico 5 días";
        cuerpoEl.innerHTML = `<p><strong>Ubicación:</strong> ${ciudad}</p>`;
        cuerpoEl.appendChild(tabsContainer);
        cuerpoEl.appendChild(contenidoDiaContainer);
        abrirModal();
      }

    } catch (error) {
      console.error("Error al obtener pronóstico:", error);
      mostrarNotificacion("No se pudo obtener el pronóstico.");
    }
  }

  // === 8. Botones de clima en el panel de capas ===
  function insertarBotonesClima() {
    const panel = document.querySelector(".leaflet-control-layers-expanded");
    if (!panel) { setTimeout(insertarBotonesClima, 200); return; }
    if (document.getElementById("weather-collapsible-section")) return;

    const weatherSection   = document.createElement('div');
    weatherSection.id      = 'weather-collapsible-section';
    weatherSection.className = 'custom-collapsible-section';

    const weatherHeader   = document.createElement('div');
    weatherHeader.className = 'custom-collapsible-header';
    weatherHeader.innerHTML = '<span class="header-text">☁️ Previsión meteorológica</span><span class="toggle-icon">▼</span>';

    const weatherContent   = document.createElement('div');
    weatherContent.className = 'custom-collapsible-content';

    const btnTiempo = document.createElement("button");
    btnTiempo.id        = "btn-tiempo";
    btnTiempo.textContent = "📍 Ver tiempo actual";
    btnTiempo.className = "btn-clima";
    btnTiempo.addEventListener("click", mostrarTiempoEnCentro);

    const btnPronostico = document.createElement("button");
    btnPronostico.id        = "btn-pronostico";
    btnPronostico.textContent = "🔮 Pronóstico 5 días";
    btnPronostico.className = "btn-clima";
    btnPronostico.addEventListener("click", mostrarPronosticoProximo);

    const buttonsInnerContainer = document.createElement('div');
    buttonsInnerContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding:8px 10px;';
    buttonsInnerContainer.appendChild(btnTiempo);
    buttonsInnerContainer.appendChild(btnPronostico);
    weatherContent.appendChild(buttonsInnerContainer);

    weatherHeader.addEventListener('click', () => {
      const isOpen = weatherContent.classList.toggle('is-open');
      weatherHeader.querySelector('.toggle-icon').textContent = isOpen ? '▲' : '▼';
    });

    weatherSection.appendChild(weatherHeader);
    weatherSection.appendChild(weatherContent);
    panel.appendChild(weatherSection);
  }

  // === 8b. Herramientas de ruta en la barra lateral ===
  function insertarBotonesRuta() {
    const panel = document.querySelector(".leaflet-control-layers-expanded");
    if (!panel) { setTimeout(insertarBotonesRuta, 200); return; }
    if (document.getElementById("ruta-tools-section")) return;

    const section = document.createElement('div');
    section.id        = 'ruta-tools-section';
    section.className = 'custom-collapsible-section';

    const header = document.createElement('div');
    header.className = 'custom-collapsible-header';
    header.innerHTML = '<span class="header-text">🗺️ Herramientas de ruta</span><span class="toggle-icon">▼</span>';

    const content = document.createElement('div');
    content.className = 'custom-collapsible-content';

    const btnPerfil = document.createElement('button');
    btnPerfil.className   = 'btn-clima';
    btnPerfil.textContent = '↗ Mostrar perfil de elevación';
    btnPerfil.addEventListener('click', () => {
      const panel = document.getElementById('elevation-panel');
      if (panel) { panel.classList.remove('hidden'); }
      map.invalidateSize();
      dibujarPerfilElevacion(_currentPct);
    });

    const btnCentrar = document.createElement('button');
    btnCentrar.className  = 'btn-clima';
    btnCentrar.textContent = '⊙ Centrar mapa en la ruta';
    btnCentrar.addEventListener('click', () => {
      if (_rutaBounds) map.flyToBounds(_rutaBounds, { padding: [30, 30], duration: 1.5 });
    });

    const aGpx = document.createElement('a');
    aGpx.id        = 'btn-descargar-gpx';
    aGpx.className = 'btn-clima';
    aGpx.textContent = '↓ Descargar ruta GPX';
    aGpx.download  = 'ruta-fundiciones.gpx';
    aGpx.style.cssText = 'display:block; text-align:center; text-decoration:none;';
    if (_gpxBlobUrl) aGpx.href = _gpxBlobUrl;

    const inner = document.createElement('div');
    inner.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding:8px 10px;';
    inner.appendChild(btnPerfil);
    inner.appendChild(btnCentrar);
    inner.appendChild(aGpx);
    content.appendChild(inner);

    header.addEventListener('click', () => {
      const isOpen = content.classList.toggle('is-open');
      header.querySelector('.toggle-icon').textContent = isOpen ? '▲' : '▼';
    });

    section.appendChild(header);
    section.appendChild(content);
    panel.appendChild(section);
  }

  // === 9. Iconos en etiquetas de leyenda ===
  function insertarIconosLeyenda() {
    const labels = document.querySelectorAll('.leaflet-layerstree-header-label');
    if (labels.length === 0) { setTimeout(insertarIconosLeyenda, 200); return; }
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

  // === 10. GLightbox ===
  let lightbox = null;
  map.on("popupopen", () => {
    if (lightbox) lightbox.destroy();
    lightbox = GLightbox({ selector: ".glightbox", touchNavigation: true, loop: false, zoomable: true });
  });

  // === 11. Control de escala ===
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 300 }).addTo(map);

  // === 12. Botón cerrar perfil ===
  document.getElementById('cerrar-perfil')?.addEventListener('click', () => {
    const panel = document.getElementById('elevation-panel');
    if (panel) { panel.classList.add('hidden'); }
    map.invalidateSize();
  });

  // Redibujar perfil al redimensionar ventana
  window.addEventListener('resize', () => {
    const panel = document.getElementById('elevation-panel');
    if (panel && !panel.classList.contains('hidden')) {
      dibujarPerfilElevacion(_currentPct);
    }
  });

})();
