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

// === 4. Variables globales (inicializadas a null para mayor claridad) ===
let capaRuta = null;
let capaPuntos = null;

// Funcion para calcular longitud de la ruta
function calcularLongitudRuta(coords) {
    let totalDist = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        totalDist += coords[i].distanceTo(coords[i + 1]); // distanceTo returns meters
    }
    return totalDist; // Return meters
}

function calcularDistanciaPorPorcentaje(coords, porcentaje) {
    let totalDist = 0;
    const distanciasSegmento = []; // Distancias de cada segmento entre dos puntos consecutivos

    for (let i = 0; i < coords.length - 1; i++) {
        const d = coords[i].distanceTo(coords[i + 1]);
        distanciasSegmento.push(d);
        totalDist += d;
    }

    let distanciaAcumuladaHastaPorcentaje = totalDist * porcentaje;
    return distanciaAcumuladaHastaPorcentaje; // Returns distance in meters
}

// === Interpolación para mover el marcador según slider ===
function interpolarPosicion(coords, porcentaje) {
    if (porcentaje <= 0) return coords[0];
    if (porcentaje >= 1) return coords[coords.length - 1];

    let totalDist = 0;
    const distancias = [];

    for (let i = 0; i < coords.length - 1; i++) {
        const d = coords[i].distanceTo(coords[i + 1]);
        distancias.push(d);
        totalDist += d;
    }

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
 * Calcula el tiempo estimado de la ruta basándose en la distancia y el desnivel positivo,
 * con una velocidad base de 4 km/h y 10 minutos/100m de ascenso.
 * @param {number} distanciaKm - La distancia horizontal total de la ruta en kilómetros.
 * @param {number} desnivelPositivoM - El desnivel positivo total de la ruta en metros.
 * @returns {string} El tiempo estimado en formato "X h Y min".
 */
function calcularTiempoRuta(distanciaKm, desnivelPositivoM) {
    // Tiempo por distancia: 4 km/h (o 15 minutos por kilómetro)
    const tiempoDistanciaMin = (distanciaKm / 4) * 60; // Convertir horas a minutos

    // Tiempo por desnivel positivo: 10 minutos por cada 100 metros de ascenso
    const tiempoDesnivelMin = (desnivelPositivoM / 100) * 10;

    let tiempoTotalMin = tiempoDistanciaMin + tiempoDesnivelMin;

    // Opcional: Redondear a la media hora más cercana para que sea más "amigable"
    tiempoTotalMin = Math.round(tiempoTotalMin / 30) * 30;

    const horas = Math.floor(tiempoTotalMin / 60);
    const minutos = tiempoTotalMin % 60;

    let resultado = "";
    if (horas > 0) {
        resultado += `${horas} h`;
    }
    if (minutos > 0) {
        if (resultado) resultado += " "; // Añadir espacio si ya hay horas
        resultado += `${minutos} min`;
    }
    if (!resultado) {
        resultado = "0 min"; // Para rutas extremadamente cortas
    }
    return resultado;
}


// === 5. Cargar capa de ruta y puntos ===
async function cargarRutaYPuntos() {
    try {
        // --- Cargar datos de la RUTA (Ruta_Fundiciones.geojson) ---
        const resRuta = await fetch("data/Ruta_Fundiciones.geojson");
        if (!resRuta.ok) {
            throw new Error(`HTTP error! status: ${resRuta.status} for Ruta_Fundiciones.geojson`);
        }
        const dataRuta = await resRuta.json();

        // Verificar que el GeoJSON de la ruta tenga features y el tipo correcto (MultiLineString)
        if (!dataRuta.features || dataRuta.features.length === 0) {
            console.error("Error: Ruta_Fundiciones.geojson no contiene features.");
            return;
        }

        // Acceder a las propiedades del primer feature de la ruta (que es tu MultiLineString)
        const rutaFeature = dataRuta.features[0];
        const rutaProperties = rutaFeature.properties;

        // Crear la capa GeoJSON de la ruta
        capaRuta = L.geoJSON(dataRuta, {
            style: { color: "#ba3b0a", weight: 4, opacity: 0.8 }
        }).addTo(map);

        // Obtener coordenadas de la ruta

        let rutaCoords = capaRuta.getLayers()[0].getLatLngs();

        // Aplanar en caso de MultiLineString para obtener una secuencia lineal de LatLngs
        if (rutaCoords.length > 0 && Array.isArray(rutaCoords[0]) && Array.isArray(rutaCoords[0][0])) {
            rutaCoords = rutaCoords.flat();
        } else if (rutaCoords.length > 0 && Array.isArray(rutaCoords[0]) && !(rutaCoords[0] instanceof L.LatLng)) {
            rutaCoords = rutaCoords.flat();
        }

        // Calculate total route length once (in meters)
        const totalRouteLengthMeters = calcularLongitudRuta(rutaCoords);
        const totalRouteLengthKm = totalRouteLengthMeters / 1000;


        // --- Cargar datos de PUNTOS DE INTERÉS (Puntos_interes.geojson) ---
        const resPuntos = await fetch("data/Puntos_interes.geojson");
        if (!resPuntos.ok) {
            throw new Error(`HTTP error! status: ${resPuntos.status} for Puntos_interes.geojson`);
        }
        const dataPuntos = await resPuntos.json();

        // Verificar que el GeoJSON de puntos tenga features
        if (!dataPuntos.features) {
            console.error("Error: Puntos_interes.geojson no contiene features.");
        }

        // === 1. Obtener y Mostrar Información del Título (DINÁMICO) ===

        // Paso 1: Obtener el desnivel positivo del GeoJSON
        const desnivelPositivoM = parseFloat(rutaProperties.desnivel) || 0;
        // Paso 2: Calcular la duración estimada usando la nueva función
        const duracionCalculada = calcularTiempoRuta(totalRouteLengthKm, desnivelPositivoM);

        // Usar la información de Ruta_Fundiciones.geojson y Puntos_interes.geojson
        const infoTituloDinamico = {
            titulo: rutaProperties.name || "Visor Etnográfico",
            subtitulo: rutaProperties.subtitulo || "Ruta Cultural",
            duracion: duracionCalculada,
            desnivel: rutaProperties.desnivel ? `${rutaProperties.desnivel} m` : "N/A metros",
            paradas: dataPuntos.features ? dataPuntos.features.length : 0 // Contar los features en Puntos_interes.geojson
        };

        // Actualizar el título en el HTML
        let tituloDiv = document.getElementById('titulo-ruta');
        if (!tituloDiv) {
            tituloDiv = document.createElement('div');
            tituloDiv.id = 'titulo-ruta';
            document.body.appendChild(tituloDiv);
        }
        tituloDiv.innerHTML = `
            <h1 style="margin: 0; font-size: 20px;">${infoTituloDinamico.titulo}</h1>
            <h2 style="margin: 0; font-size: 18px;">${infoTituloDinamico.subtitulo}</h2>
            <div style="font-size: 14px; margin-top: 4px;">
                Paradas: ${infoTituloDinamico.paradas} | Longitud total: ${totalRouteLengthKm.toFixed(1).replace('.', ',')} km<br>
                Duración estimada: ${infoTituloDinamico.duracion} | Desnivel: ${infoTituloDinamico.desnivel}
            </div>
        `;

        //! === 5.1. Desplazamiento animado al cargar ===
        const rutaBounds = capaRuta.getBounds();
        capaRuta.setStyle({ weight: 1 });
        map.flyToBounds(rutaBounds, {
            paddingTopLeft: [100, 50], // Ajustado para centrar verticalmente, laterales menos
            paddingBottomRight: [100, 50],
            duration: 4, // Duración de la animación en segundos
            easeLinearity: 0.5,
        });
        map.once("moveend", () => { capaRuta.setStyle({ weight: 4 }); });

        // === Crear marcador al inicio con icono personalizado ===
        const iconoMarcador = L.icon({
            iconUrl: "assets/img/marcador-ruta.png",
            iconSize: [50, 50],
            iconAnchor: [25, 50],
            popupAnchor: [0, -55],
            className: 'leaflet-marker-icon-ruta'
        });

        // Colocar el marcador en el punto inicial DESEADO (0 km)
        if (rutaCoords.length > 0) {
            const marcadorInicialPorcentaje = 0.004;
            const marcadorInicialPos = interpolarPosicion(rutaCoords, marcadorInicialPorcentaje); // Calcula la posición
            const marcador = L.marker(marcadorInicialPos, { icon: iconoMarcador }).addTo(map);
            marcador.bindPopup("🚶 Posición actual en la ruta");

            // Obtener el elemento para mostrar el valor del slider
            const sliderValueSpan = document.getElementById("slider-value");
            const sliderRuta = document.getElementById("slider-ruta");

            if (sliderRuta) {
                sliderRuta.value = marcadorInicialPorcentaje * 100;
                if (sliderValueSpan) {
                    const initialKm = (calcularDistanciaPorPorcentaje(rutaCoords, marcadorInicialPorcentaje) / 1000).toFixed(1);
                    const totalKmFormatted = totalRouteLengthKm.toFixed(1).replace('.', ','); // Formatear también la longitud total
                    sliderValueSpan.textContent = `${initialKm.replace('.', ',')} km / ${totalKmFormatted} km`;
                }
                sliderRuta.style.setProperty('--_slider-fill-percent', `${sliderRuta.value}%`);
            }


            // === Evento del slider para mover el marcador ===
            sliderRuta.addEventListener("input", (e) => {
                const porcentaje = e.target.value / 100;
                const nuevaPos = interpolarPosicion(rutaCoords, porcentaje);
                marcador.setLatLng(nuevaPos);

                // Update the span text with the current km and total km
                if (sliderValueSpan) {
                    const currentKm = (calcularDistanciaPorPorcentaje(rutaCoords, porcentaje) / 1000).toFixed(1);
                    const totalKmFormatted = totalRouteLengthKm.toFixed(1).replace('.', ','); // Reutilizar la longitud total
                    sliderValueSpan.textContent = `${currentKm.replace('.', ',')} km / ${totalKmFormatted} km`;
                }
                sliderRuta.style.setProperty('--_slider-fill-percent', `${e.target.value}%`);
            });
        } else {
            console.warn("No se encontraron coordenadas en la ruta para el marcador.");
        }

        // === Icono personalizado para Puntos de Interés ===
        const iconoPuntoInteres = L.icon({
            iconUrl: "assets/img/marcador-puntos.png", // <--- Asegúrate de que esta ruta sea correcta
            iconSize: [50, 50], // Ancho: 50px, Alto: 50px
            iconAnchor: [25, 50], // Ancla en la base central del icono (mitad del ancho, y todo el alto)
            popupAnchor: [0, -45], // Ajuste para que el popup aparezca justo encima del icono
            className: 'leaflet-marker-icon-puntos'
        });
        
        // === 6. Cargar puntos de interés ===
        capaPuntos = L.geoJSON(dataPuntos, {
            pointToLayer: (feature, latlng) => {
                // Aquí es donde cambiamos el marcador predeterminado por tu icono personalizado
                const marker = L.marker(latlng, { icon: iconoPuntoInteres }); // <--- ¡CAMBIO AQUÍ!
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
                feature._titleMarker = titleMarker; // Adjuntar el titleMarker al feature
                return marker; // Devuelve el marcador con tu icono personalizado
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const nombre = props.nombre || "";
                const descripcion = props.descripcion || "";
                const url = props.url || "";
                const categoria = props.categoria || "";
                const IMAGES_BASE_PATH = 'assets/img/'; // Define la ruta base para tus imágenes

                const imagenesRelativas = props.imagen ? props.imagen.split(";").map(s => s.trim()) : [];

                const galeriaHTML = imagenesRelativas.length > 0 ? `
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:0.5rem;">
                        ${imagenesRelativas.map((rutaRelativa, idx) => {
                                const rutaCompleta = IMAGES_BASE_PATH + rutaRelativa; // <--- ¡CAMBIO CLAVE AQUÍ!
                            return `
                                <a href="${rutaCompleta}" class="glightbox" data-gallery="gallery-${feature.properties.id}" data-title="${nombre} - imagen ${idx + 1}">
                                    <img src="${rutaCompleta}" alt="${nombre} - imagen ${idx + 1}" style="width:80px; height:auto; border-radius:6px; object-fit:cover;" />
                                </a>
                            `;
                            }).join('')}
                    </div>` : "";

                const html = `
                    <h3>${nombre}</h3>
                    <p>${descripcion}</p>
                    ${galeriaHTML}
                    ${url ? `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${categoria}</a></p>` : ""}
                `;

                layer.bindPopup(html);
            }
        }).addTo(map);

        // Añadir los titleMarkers a la capa de puntos después de que se hayan creado
        capaPuntos.eachLayer(layer => {
            if (layer.feature && layer.feature._titleMarker) {
                layer.feature._titleMarker.addTo(capaPuntos);
            }
        });


        // --- CONTROL DE CAPAS ---
        const baseMapsTree = {
            label: "🗺️ Mapas base",
            children: [
                { label: "OpenStreetMap", layer: capaOSM },
                { label: "Ortofotos PNOA (IGN)", layer: capaPNOA },
                { label: "CartoDB Positron", layer: CartoDB_Positron },
                { label: "Esri World Street Map", layer: Esri_WorldStreetMap },
                { label: "Esri World Imagery", layer: Esri_WorldImagery },
                { label: "Esri World Topo Map", layer: Esri_WorldTopoMap }
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

        insertarBotonesClima();
        insertarIconosLeyenda();

        // === 10. Reordenar el panel de capas (superpuestas arriba) ===
        // Añadido un pequeño retraso para asegurar que el DOM esté actualizado
        setTimeout(() => {
            try {
                const panelList = document.querySelector('.leaflet-control-layers-list');
                const baseGroup = document.querySelector('.leaflet-control-layers-base');
                const overlaysGroup = document.querySelector('.leaflet-control-layers-overlays');
                const separator = document.querySelector('.leaflet-control-layers-separator');

                if (panelList && baseGroup && overlaysGroup && separator) {
                    panelList.insertBefore(overlaysGroup, baseGroup);
                    panelList.insertBefore(separator, baseGroup);
                } else {
                    console.warn('No se encontraron todos los elementos necesarios para reordenar el panel de capas. (Podría ser normal si no se ha cargado aún completamente el panel)');
                }
            } catch (error) {
                console.warn('⚠️ No se pudo reordenar el panel de capas:', error);
            }
        }, 100); // Pequeño retraso para asegurar la carga del DOM

    } catch (error) {
        console.error("Error al cargar ruta o puntos:", error);
        // Si hay un error, actualizar el título para informar al usuario
        let tituloDiv = document.getElementById('titulo-ruta');
        if (tituloDiv) {
            tituloDiv.innerHTML = `
                <h1 style="margin: 0; font-size: 20px; color: red;">Error al cargar la ruta</h1>
                <h2 style="margin: 0; font-size: 18px; color: red;">Por favor, recarga la página.</h2>
            `;
        }
    }
}

cargarRutaYPuntos();


// === 7. Mostrar tiempo actual (en modal) ===
// Tu clave API de OpenWeatherMap, considera moverla a un archivo de configuración si el proyecto crece
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
        const modalContent = modal.querySelector(".modal-content"); // Ya no se usa directamente en este scope

        modal.addEventListener("click", (e) => {
            if (e.target === modal) { // Si clicaste en el fondo (el modal contenedor)
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


// === 8. Botones y secciones personalizados dentro del panel de capas ===
function insertarBotonesClima() {
    const panel = document.querySelector(".leaflet-control-layers-expanded");
    if (!panel) {
        setTimeout(insertarBotonesClima, 200);
        return;
    }

    // Asegura que no se duplique todo el bloque de control de clima
    if (document.getElementById("weather-collapsible-section")) return;

    // --- SECCIÓN COLAPSABLE PARA PREVISIÓN METEOROLÓGICA ---
    const weatherSection = document.createElement('div');
    weatherSection.id = 'weather-collapsible-section'; // ID único para esta sección
    weatherSection.className = 'custom-collapsible-section'; // Usa la misma clase base para estilos

    const weatherHeader = document.createElement('div');
    weatherHeader.className = 'custom-collapsible-header'; // Clase para estilo de cabecera
    weatherHeader.innerHTML = '<span class="header-text">☁️ Previsión meteorológica</span><span class="toggle-icon">▼</span>'; // Título e icono

    const weatherContent = document.createElement('div');
    weatherContent.className = 'custom-collapsible-content';
    weatherContent.style.display = 'none'; // Inicialmente oculto

    // Mueve los botones existentes de tiempo aquí dentro
    const btnTiempo = document.createElement("button");
    btnTiempo.id = "btn-tiempo";
    btnTiempo.textContent = "📍 Ver tiempo actual";
    btnTiempo.className = "btn-clima";
    btnTiempo.addEventListener("click", mostrarTiempoEnCentro);

    const btnPronostico = document.createElement("button");
    btnPronostico.id = "btn-pronostico";
    btnPronostico.textContent = "🔮 Pronóstico 5 días";
    btnPronostico.className = "btn-clima";
    btnPronostico.addEventListener("click", mostrarPronosticoProximo);

    // Contenedor interno para los botones, para espaciado y flexbox
    const buttonsInnerContainer = document.createElement('div');
    buttonsInnerContainer.style.display = 'flex';
    buttonsInnerContainer.style.flexDirection = 'column';
    buttonsInnerContainer.style.gap = '6px';
    buttonsInnerContainer.style.padding = '8px 10px'; // Un poco de padding interno

    buttonsInnerContainer.appendChild(btnTiempo);
    buttonsInnerContainer.appendChild(btnPronostico);
    weatherContent.appendChild(buttonsInnerContainer); // Añade el contenedor de botones al contenido colapsable

    // Lógica para expandir/colapsar
    weatherHeader.addEventListener('click', () => {
        const isHidden = weatherContent.style.display === 'none';
        weatherContent.style.display = isHidden ? 'block' : 'none';
        weatherHeader.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';

        // Opcional: Ajusta max-height y opacity para una transición suave
        if (isHidden) {
            weatherContent.style.maxHeight = weatherContent.scrollHeight + 'px';
            weatherContent.style.opacity = '1';
        } else {
            weatherContent.style.maxHeight = '0';
            weatherContent.style.opacity = '0';
        }
    });

    weatherSection.appendChild(weatherHeader);
    weatherSection.appendChild(weatherContent);

    // Añadir la sección completa al panel de capas
    panel.appendChild(weatherSection);
}


// === 11. Insertar iconos en etiquetas de leyenda ===
function insertarIconosLeyenda() {
    const labels = document.querySelectorAll('.leaflet-layerstree-header-label');
    if (labels.length === 0) {
        setTimeout(insertarIconosLeyenda, 200); // Reintentar si no se encuentran las etiquetas
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

// === 13. Inicializar GLightbox ===
let lightbox = null;
map.on("popupopen", () => {
    // Destruye el lightbox existente antes de crear uno nuevo para evitar conflictos
    if (lightbox) lightbox.destroy();
    lightbox = GLightbox({ selector: ".glightbox", touchNavigation: true, loop: false, zoomable: true });
});

// === 14. Marca de Agua ===
const infoMarcaAgua = {
    autorRuta: "Pedro Alcobas",
    autorVisor: '<a href="mailto:pedralcg.dev@gmail.com">pedralcg</a>',
    fuente: `<a href="https://www.ign.es" target="_blank" rel="noopener noreferrer">© IGN España</a> /
             <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>`,
    fuenteClima: `<a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">© OpenWeather</a>`,
    web: '<a href="https://pedralcg.github.io/" target="_blank" rel="noopener noreferrer">Web</a>',
    repo: '<a href="https://github.com/pedralcg/visor-ruta-etnografica-leaflet" target="_blank" rel="noopener noreferrer">GitHub</a>',
    licenciaCodigo: '<a href="http://creativecommons.org/licenses/by-nc/4.0/" target="_blank">CC BY-NC 4.0</a>',
    licenciaContenidos: 'Todos los derechos reservados (textos e imágenes)'
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
actualizarMarcaAgua(infoMarcaAgua);


// === 15. Control de escala (dinámico) ===
L.control.scale({
    position: 'bottomleft',
    imperial: false,
    maxWidth: 300
}).addTo(map);
