# 🐞 Registro de Bugs y Problemas Conocidos

Este archivo recoge los errores y problemas detectados en el proyecto para su seguimiento y control.

---

## Incidencias

### ✅ Bug 001: Etiquetas visibles al desactivar capa de puntos

- **Descripción:**  
  Al desactivar la capa de puntos de interés, las etiquetas (marcadores de títulos) continúan visibles sobre el mapa.

- **Archivo / Lugar:**  
  `script.js` — control de capas y etiquetas.

- **Fecha detección:**  
  2025-06-27

- **Estado:**  
  ✅ Resuelto (2025-06-30)

- **Solución aplicada:**  
  Se integraron las etiquetas dentro de `capaPuntos`, lo que permite que desaparezcan automáticamente al desactivar la capa desde el panel de control.

---

❌