# Proyecto QGIS - Visor Etnográfico

Este archivo `.qgz` contiene el proyecto QGIS utilizado para la edición de los datos del visor web.

## Contenido

- `ruta.geojson`: ruta principal representada como línea.
- `puntos.geojson`: puntos de interés (paradas) a lo largo de la ruta.
- Capa base de fondo para facilitar la localización.

## Uso

1. Abrir el archivo `visor-etnografico.qgz` con QGIS.
2. Realizar modificaciones en las capas GeoJSON:
   - Mover puntos de interés.
   - Ajustar la ruta.
   - Añadir/eliminar/modificar elementos si fuera necesario.
3. Guardar cambios directamente en los archivos `.geojson` ubicados en `/data/`.

## Notas

- Asegúrate de mantener la estructura de atributos para garantizar la compatibilidad con el visor.
- No es necesario reproyectar las capas: trabajan en EPSG:4326.
