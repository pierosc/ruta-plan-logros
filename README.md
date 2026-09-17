# Plan de Logros

Frontend responsive en React para convertir documentos de Plan de Logros en un checklist personal. Incluye los 20 logros y 60 acciones del documento de referencia como plan inicial.

## Ejecutar en localhost

```bash
pnpm install
pnpm dev
```

Abre la dirección que muestre Vite (normalmente `http://localhost:5173`).

## Funciones

- Lectura local de archivos Word `.doc` y `.docx`, PDF `.pdf` y texto `.txt`.
- Nombre personalizado por persona en el menú y en el título de la pestaña.
- Favicon propio para identificar la aplicación en el navegador.
- Checklist por logro y por acción, con progreso general y por área.
- Notas personales, buscador y filtros por estado o categoría.
- Persistencia automática en `localStorage`.
- Respaldo descargable en JSON y restauración del plan inicial.
- Botón **Descargar PDF** junto a **Mis logros**, con el plan completo, estados, fechas, notas e imágenes de cada acción (independiente de los filtros).
- PDF con portada, resumen por área, tarjetas de colores y fotos sin nombres de archivo ni pies de imagen. Usa el título «Mis logros» y omite «Quién quiero ser».
- Evidencias de imágenes (hasta 8 MB) y videos (hasta 50 MB), con un máximo de 4 archivos por acción. El PDF captura un fotograma de cada video compatible con el navegador.
- Secciones por área que se pueden contraer y expandir.
- Diseño adaptable para escritorio, tablet y teléfono.

## Publicación

Sitio publicado: [Plan de Logros](https://pierosc.github.io/ruta-plan-logros/).

El proyecto incluye un workflow en `.github/workflows/deploy-pages.yml` que compila y publica automáticamente en GitHub Pages cada vez que se actualiza la rama `main`.

Los documentos y avances se procesan y almacenan dentro del navegador; la aplicación no los envía a un servidor.

El PDF también se genera localmente e incluye las imágenes y un fotograma de cada video guardado en este navegador. Los archivos originales se conservan. Si alguna evidencia falta o su formato no se puede leer, se señala en el PDF y al finalizar la descarga. Puedes volver a adjuntarla en un formato compatible y generar el documento de nuevo.
