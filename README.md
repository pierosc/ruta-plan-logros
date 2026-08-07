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
- Secciones por área que se pueden contraer y expandir.
- Diseño adaptable para escritorio, tablet y teléfono.

## Publicación

El proyecto incluye un workflow en `.github/workflows/deploy-pages.yml` que compila y publica automáticamente en GitHub Pages cada vez que se actualiza la rama `main`.

Los documentos y avances se procesan y almacenan dentro del navegador; la aplicación no los envía a un servidor.
