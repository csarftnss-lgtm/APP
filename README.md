# PrepCoach

App de nutrición deportiva (cuestionario, planificación, menú diario, minutas y seguimiento) publicada con GitHub Pages.

## Estructura
- `index.html`: página principal.
- `css/styles.css`: estilos (incluye tema oscuro/claro y estilo Glass UI).
- `js/app.js`: toda la lógica de la app.
- `js/foods.js`: base de alimentos inicial.

## Reglas para editar (también para Claude)
1. Este repositorio es la versión oficial. Antes de cada cambio, trabajar sobre la última versión de `main`.
2. Los datos se guardan en el navegador del usuario (localStorage/IndexedDB, claves que empiezan con `prepcoach-`). No cambiar esas claves ni la estructura de datos sin agregar una migración en `migrate()` / `migrateAthlete()` que conserve lo existente.
3. No cambiar el nombre del repositorio ni la dirección de GitHub Pages: los datos están ligados a esa dirección.
4. Probar cada cambio antes de publicarlo (abrir `index.html` en el navegador) y hacer commit + push a `main`. GitHub Pages publica solo en 1-2 minutos.
5. Respaldo: desde la app, botón ⬇ "Exportar respaldo (JSON)"; para restaurar, ⬆ "Importar respaldo".

## Fuera de Claude
- Funciona en modo local: los datos quedan en cada navegador (no se sincronizan entre dispositivos).
- El portal del cliente requiere el artifact de Claude; aquí no está disponible.
- Generar PDF requiere conexión a internet (se carga pdfmake desde cdnjs).
