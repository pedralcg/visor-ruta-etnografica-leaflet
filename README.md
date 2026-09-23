# 🗺️ Visor Etnográfico con Leaflet

![Visor de la Ruta de las Fundiciones en La Unión con sus paradas y perfil](https://res.cloudinary.com/dhnr62lyo/image/upload/w_1200,f_auto,q_auto/v1772720317/pedralcg.dev/projects/rwpikmnhhmy9o0rofhqy.png)

**[Ver la demo en vivo](https://pedralcg.github.io/visor-ruta-etnografica-leaflet/)** · [Ficha del proyecto en pedralcg.dev](https://pedralcg.dev/projects/mapa-etnoturistico-ruta-de-las-fundiciones)

Este proyecto es un visor web interactivo desarrollado con **Leaflet.js**, diseñado para mostrar rutas culturales o etnográficas junto con **puntos de interés multimedia**. Incluye popups enriquecidos, galería de imágenes, control de capas y compatibilidad con dispositivos móviles. Ideal para rutas interpretativas, senderos históricos o recursos patrimoniales georreferenciados.

---

## 1. 🌟 Funcionalidades principales

* 📍 Visualización de una **ruta principal** mediante GeoJSON con estilo personalizado.
* 🏛️ **Puntos de interés** interactivos con texto, imágenes ampliables y enlaces externos.
* 📷 Galería de imágenes para cada punto con **GLightbox**.
* 🔘 **Control de capas jerárquico** con leyenda visual, usando `Leaflet.Control.Layers.Tree`.
* 🗺️ **Múltiples mapas base**: OSM, PNOA, CartoDB, Esri, OpenTopoMap.
* ⛅ **Visualización del tiempo actual** y **pronóstico a 5 días** con datos de OpenWeather y diseño modal.
* 🚀 Animación de enfoque al cargar la ruta (`flyToBounds`).
* 📏 **Slider interactivo de progreso de ruta** que permite desplazar un marcador a lo largo de la ruta y muestra la distancia recorrida.
* 📐 Escala gráfica dinámica y marca de agua informativa.
* 📱 Diseño responsive para móviles y tablets.

---

## 2. 🛠️ Estado actual y hoja de ruta

**Estado actual:**  
Proyecto funcional (`v0.3`) con las siguientes mejoras incorporadas:

* **Slider interactivo de progreso de ruta** con marcador dinámico, permitiendo un desplazamiento suave y visualización de kilómetros.
* Añadida la **visualización meteorológica** (tiempo actual + pronóstico) en modal reutilizable.
* Sustituido el control tradicional de capas por un sistema **jerárquico con leyenda**.
* Añadidos **nuevos mapas base** (CartoDB, Esri, OpenTopoMap...).

**Últimas mejoras:**

* Galería multimedia con GLightbox en popups.
* Mejora del diseño responsive y panel de capas lateral.
* Integración de información climática interactiva.
* Ampliación de mapas base y reorganización de capas.
* **Control de progreso de ruta con slider interactivo.**
* Mejoras visuales: Implementación de halos y sombras para los marcadores, y sincronización de iconos en leyenda.
* Contenido de ruta actualizado y gestión de imágenes optimizada (2025-07-10).

**Próximas mejoras previstas:**

| Prioridad | Mejora prevista                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| 🔜        | Mostrar perfil de elevación con [`leaflet-elevation`](https://github.com/MrMufflon/Leaflet.Elevation)       |
| 🔜        | Agrupar puntos con [`Leaflet.markercluster`](https://github.com/Leaflet/Leaflet.markercluster)              |
| 🔜        | Buscador de puntos con [`Leaflet.Control.Search`](https://github.com/stefanocudini/leaflet-control-search)  |
| 🧪        | Exportación de mapa como imagen o GPX                                                                       |

---

## 3. 🔗 Demo en línea

🌐 [https://pedralcg.github.io/visor-ruta-etnografica-leaflet](https://pedralcg.github.io/visor-ruta-etnografica-leaflet)

---

## 4. 🧰 Tecnologías utilizadas

* [Leaflet.js](https://leafletjs.com/)
* [GLightbox](https://github.com/biati-digital/glightbox)
* [Leaflet.Control.Layers.Tree](https://github.com/jjimenezshaw/leaflet-layers-tree)
* [Leaflet.MovingMarker](https://github.com/ewoken/Leaflet.MovingMarker)
* [OpenWeather API](https://openweathermap.org/)
* HTML5, CSS3, JavaScript (Vanilla)
* Formatos de datos: GeoJSON, JSON

---

## 5. 🚀 Instalación y uso

1. Clona el repositorio completo:

   ```bash
   git clone https://github.com/pedralcg/visor-ruta-etnografica-leaflet.git
   ```

2. Accede a la carpeta del proyecto:

   ```bash
   cd visor-ruta-etnografica-leaflet
   ```

3. Abre el archivo `index.html` en tu navegador favorito (se recomienda Firefox o Chrome).

   ⚠️ No requiere servidor ni instalación adicional. Funciona en local o mediante GitHub Pages.
   💡 Consejo: Para una mejor experiencia, puedes usar Live Server en VSCode.

---

## 6. 📁 Estructura del proyecto

```bash
visor-ruta-etnografica-leaflet/
│
├── index.html           # Página principal del visor
├── style.css            # Estilos generales y del mapa
├── script.js            # Lógica del visor: mapa, capas, popups
│
├── /data/               # Datos vectoriales
│   ├── Ruta_Fundiciones.geojson
│   └── puntos.json
│
├── /assets/             # Imágenes, iconos y recursos multimedia
├── /libs/               # Librerías externas (GLightbox, plugins Leaflet)
├── /qgis/               # Proyecto QGIS (.qgz) para edición de datos
└── README.md
```

---

## 7. 🗺️ Uso del proyecto QGIS

En la carpeta `/qgis/` se incluye el archivo `visor-etnografico.qgz`, que contiene el proyecto QGIS con:

* Las capas GeoJSON de la ruta y puntos.
* Capa base de referencia para facilitar la edición.

Este archivo permite modificar fácilmente la ubicación o atributos de los puntos y la ruta sin perder estilos ni configuración.

---

## 8. 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si quieres colaborar en mejoras, nuevas funcionalidades o corrección de errores:

* Haz un fork del repositorio.
* Crea una rama para tu mejora (`git checkout -b mejora-nueva`).
* Realiza los cambios y haz commit con mensajes claros.
* Envía un pull request describiendo tus cambios.

---

## 9. 📋 Registro de bugs y problemas conocidos

Este visor está en desarrollo activo. A continuación se listan los errores detectados y su estado de resolución para facilitar el seguimiento.

🔗 Consulta el archivo [`BUGS.md`](./BUGS.md) para más detalles y para ver el historial completo de errores actuales o resueltos.

---

## 10. 🐞 Reportar bugs y solicitar mejoras

Si encuentras algún error o tienes ideas para nuevas funcionalidades, por favor:

* Abre un issue en este repositorio con una descripción detallada.
* O contáctame directamente por email (ver sección de contacto).

Esto ayuda a mantener el proyecto actualizado y útil para todos.

---

## 11. 📬 Contacto

Para dudas, sugerencias o reporte de errores:

**Pedro Alcoba Gómez**
Técnico ambiental especializado en SIG, teledetección y desarrollo de visores web.
📧 [pedralcg.dev@gmail.com](mailto:pedralcg.dev@gmail.com)
🌐 [https://pedralcg.github.io](https://pedralcg.github.io)

---

## 12. 📄 Licencia

Este proyecto está bajo la Licencia **Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)**.

Esto significa que puedes:

- **Compartir**: Copiar y redistribuir el material en cualquier medio o formato.
- **Adaptar**: Remezclar, transformar y construir a partir del material.

Bajo las siguientes condiciones:

- **Atribución**: Debes dar crédito de manera adecuada, brindar un enlace a la licencia, e indicar si se han realizado cambios.
- **NoComercial**: No puedes hacer uso del material con propósitos comerciales.

Para ver una copia de esta licencia, visita [http://creativecommons.org/licenses/by-nc/4.0/](http://creativecommons.org/licenses/by-nc/4.0/) o consulta el archivo `LICENSE`.

Para uso comercial, por favor contactar con el autor.
