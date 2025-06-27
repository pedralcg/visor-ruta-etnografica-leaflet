# 🗺️ Visor Etnográfico con Leaflet

Este proyecto es un visor web interactivo desarrollado con **Leaflet.js**, diseñado para mostrar rutas culturales o etnográficas junto con **puntos de interés multimedia**. Incluye popups enriquecidos, galería de imágenes, control de capas y compatibilidad con dispositivos móviles. Ideal para rutas interpretativas, senderos históricos o recursos patrimoniales georreferenciados.

---

## 1. 🌟 Funcionalidades principales

* 📍 Visualización de una **ruta principal** mediante GeoJSON con estilo personalizado.
* 🏛️ **Puntos de interés** interactivos con texto, imágenes ampliables y enlaces externos.
* 📷 Galería de imágenes para cada punto con **GLightbox**.
* 🔘 **Control de capas** para activar/desactivar rutas y puntos de interés.
* 🚀 Animación de enfoque al cargar la ruta (flyToBounds).
* 📐 Escala gráfica dinámica y marca de agua informativa.
* 📱 Diseño responsive para móviles y tablets.

---

## 2. 🛠️ Estado actual y hoja de ruta

**Estado actual:**

* Proyecto funcional (v0.1), con todas las capas cargadas dinámicamente y estructura base terminada.

**Últimas mejoras:**

* Galería multimedia con GLightbox en popups.
* Optimización del panel de capas lateral.
* Diseño responsive inicial con control de escala y metainformación.

**Próximas mejoras previstas:**

| Prioridad | Mejora prevista                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| 🔜        | Integrar animación de marcador con [`Leaflet.MovingMarker`](https://github.com/ewoken/Leaflet.MovingMarker) |
| 🔜        | Mostrar perfil de elevación con [`leaflet-elevation`](https://github.com/MrMufflon/Leaflet.Elevation)       |
| 🔜        | Agrupar puntos con [`Leaflet.markercluster`](https://github.com/Leaflet/Leaflet.markercluster)              |
| 🔜        | Buscador de puntos con [`Leaflet.Control.Search`](https://github.com/stefanocudini/leaflet-control-search)  |
| 🔜        | Organización jerárquica de capas y más variedad de fondos base                                              |
| 🧪        | Exportación de mapa como imagen o GPX                                                                       |

---

## 3. 🔗 Demo en línea

🌐 [https://pedralcg.github.io/visor-ruta-etnografica-leaflet](https://pedralcg.github.io/visor-ruta-etnografica-leaflet)

---

## 4. 🧰 Tecnologías utilizadas

* [Leaflet.js](https://leafletjs.com/)
* [GLightbox](https://github.com/biati-digital/glightbox)
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

## 9. 🐞 Reportar bugs y solicitar mejoras

Si encuentras algún error o tienes ideas para nuevas funcionalidades, por favor:

* Abre un issue en este repositorio con una descripción detallada.
* O contáctame directamente por email (ver sección de contacto).

Esto ayuda a mantener el proyecto actualizado y útil para todos.

---

## 10. 📬 Contacto

Para dudas, sugerencias o reporte de errores:

**Pedro Alcoba Gómez**
Técnico ambiental especializado en SIG, teledetección y desarrollo de visores web.
📧 [pedralcg@gmail.com](mailto:pedralcg@gmail.com)
🌐 [https://pedralcg.github.io](https://pedralcg.github.io)

---

## 11. 📄 Licencia

Este proyecto está disponible bajo la licencia **MIT**.

Puedes usarlo, modificarlo y distribuirlo libremente, incluso con fines comerciales, siempre que mantengas los créditos del autor original.

Consulta el archivo [LICENSE](LICENSE) para más información.
