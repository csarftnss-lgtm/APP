# PrepCoach: instrucciones para Claude

Claude lee este archivo al abrir cualquier chat nuevo sobre este repositorio. Aquí está todo lo necesario para seguir el trabajo sin el chat anterior.

**Privacidad:** el repositorio es **público**. Nunca escribas aquí ni en ningún archivo del repo nombres de atletas, datos de salud, correos ni respaldos.

## 1. Qué es
- PrepCoach es una app de nutrición deportiva para un coach. Tiene cuestionario, requerimientos, planificación por etapas, menú diario, recetario, distribución de comidas, descarga de la planificación en PDF, seguimiento diario y semanal, y Población general.
- Está hecha en JavaScript sin frameworks y sin paso de compilación.
- Repositorio: `csarftnss-lgtm/APP`, rama `main`.
- App publicada: https://csarftnss-lgtm.github.io/APP/ (GitHub Pages, desde `main`).
- Rama de trabajo del chat en la nube: después de subir a `main`, también `git push -f origin main:<rama-del-chat>` si el entorno la exige.

## 2. Reglas del usuario (textuales, siempre vigentes)
1. "El repositorio de GitHub es la versión oficial. Antes de cada cambio, descarga la última versión del repositorio."
2. "Los datos de mis atletas se guardan en el navegador (localStorage/IndexedDB con claves "prepcoach-…"). No cambies esas claves ni la estructura de los datos sin agregar una migración que conserve lo que ya existe."
3. "No cambies el nombre del repositorio ni la dirección de la app."
4. "Después de cada cambio, prueba la app, súbelo al repositorio (commit y push a main) y confírmame cuando GitHub Pages lo haya publicado."
5. "Si conviene, separa el index.html en archivos (css/styles.css, js/app.js, js/foods.js) para que editar sea más fácil, sin cambiar el funcionamiento." (Esto ya está hecho.)

Forma de trabajar con el usuario:
- Responde **siempre en español**, de forma concisa y explicando el porqué.
- Si un pedido es ambiguo o tiene un problema de criterio, analízalo con ojo crítico y propone algo antes de implementarlo.
- Al terminar, resume qué cambió y cómo probarlo en la app.

## 3. Flujo de cada cambio
1. `git pull origin main`.
2. Edita `js/app.js`, `css/styles.css` o `js/foods.js`.
3. Revisa la sintaxis con `node --check js/app.js`.
4. Prueba con Playwright (sección 4). Al menos debe pasar esto: carga sin errores de consola, ingreso, navegación por las rutas, la función nueva y la persistencia tras recargar.
5. Haz commit en español con un título corto que describa el cambio, y `git push origin main`.
6. Confirma la publicación. Con las herramientas de GitHub (`actions_list` / `actions_get`) busca la ejecución "pages build and deployment" del commit y espera a que el job `deploy` termine en `success`. No uses `sleep`, está bloqueado; consulta el estado de nuevo. Luego avísale al usuario que ya está publicado.

## 4. Cómo probar (Playwright ya viene instalado: `require('playwright')`)
- **Servidor:** copia el repo bajo una carpeta `APP` para que la ruta coincida con Pages.
  ```bash
  mkdir -p $SCRATCH/site && rsync -a --delete --exclude .git ./ $SCRATCH/site/APP/
  python3 -m http.server 8765 --directory $SCRATCH/site   # en segundo plano
  ```
  Luego abre `http://localhost:8765/APP/`. Repite el `rsync` después de cada edición.
- **Ingreso:** la app pide usuario y clave. Para probar sin la clave, pon en localStorage `prepcoach-auth` con el valor de la constante `AUTH_HASH` de `js/app.js` y recarga. No copies ese valor en archivos nuevos.
- **Rutas:** se guardan en localStorage `prepcoach-route` (`inicio` = selección de usuarios, `atleta` = resumen del atleta, `cuestionario`, `plan/req`, `plan/planif`, `plan/menu`, `plan/dist`, `plan/minuta`, `plan/alimentos`, `seg`, `acceso`, `pg`). Fija la clave y recarga, o navega con `#/ruta`.
- **Importar un respaldo:** usa `setInputFiles('#json-input', archivo)` y luego confirma en `#modal-root .btn.primary`.
- **Leer el estado:** está en IndexedDB `prepcoach`, store `kv`, clave `state`.
- **PDF (pdfmake 0.2.7 desde cdnjs):**
  - Si cdnjs no responde en el contenedor, instala `npm i pdfmake@0.2.7` en el scratchpad.
  - Sirve `build/pdfmake.min.js` y `vfs_fonts.js` con `page.route('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/*', …)`.
  - Revisa el PDF descargado con `pdfinfo`, `pdftotext` y `pdftoppm`.
- **Celular:** también prueba en un viewport de unos 390 px. No debe haber scroll horizontal.

## 5. Arquitectura
- `index.html` solo tiene la estructura y carga `css/styles.css`, `js/foods.js` y `js/app.js`.
- **Ancho:** `.app` no tiene ancho máximo: usa todo el ancho de la ventana, así que al bajar el zoom del navegador el contenido se amplía en vez de quedar centrado. El panel lateral (`.plan-layout`) mide `clamp(256px, 13vw, 300px)`. La vista previa del documento mantiene el ancho de una hoja A4.
- `js/app.js` es una sola IIFE con toda la lógica, de unas 4.800 líneas.
- `js/foods.js` define `window.SEED_FOODS` como `[name, porcion, gpp, kcal, p, c, g]`.
- **Persistencia:**
  - El estado `S` vive en IndexedDB `prepcoach` → `kv` → `state`. Si falla, usa localStorage `prepcoach-state`.
  - Otras claves de localStorage: `prepcoach-theme`, `prepcoach-route`, `prepcoach-collapsed`, `prepcoach-sb` y `prepcoach-auth`. `prepcoach-auth` también puede estar en sessionStorage.
  - **No cambies ninguna clave.**
- **Respaldo:**
  - ⬇ exporta todo `S` en JSON; ⬆ lo importa y reemplaza el estado.
  - Las imágenes van dentro del JSON como data URL, así que un respaldo puede pesar varios MB.
- **Estado:**
  - `S = { v, foods[], athletes[], activeId, recipes[], foodsSeedN, pg }`.
  - `S.pg = { clients: [{ id, nombre, creado }], activeId }`: usuarios de Población general, aparte de los atletas.
  - Cada atleta tiene `{ id, q, req, dayTypes[], activeDay, tracking:{config, weeks, daily}, ui, calendar, portal, planif… }`.
- **Migraciones:**
  - `migrate(s)` y `migrateAthlete(a)` se ejecutan al cargar y al importar.
  - Las conversiones de una sola vez usan banderas en `tracking.config`: `reqsSeeded`, `signedObj`, `weeksByDate`, `rangos`, y además `a.planif.movedToStages` y `S.foodsSeedN`.
  - La bandera se lee **antes** de `Object.assign(base.config, existente)`, porque los valores por defecto la dejarían en `true`.
  - Todo cambio de estructura nuevo lleva su propia bandera y conserva los datos que ya existen.
- **Helpers de UI:**
  - Campos enlazados: `I(path,{num,live,ph,cls,attrs,value})`, `SEL`, `D`, `TA`, `F`.
  - En la ruta del campo, `@` apunta a `S`, `#` al estado transitorio `T`, y sin prefijo al atleta activo `A()`.
  - Los botones usan `data-action="x"`, que llama a `actions.x`.
  - `commit()` guarda y vuelve a dibujar.
  - `live:true` vuelve a dibujar mientras se escribe.
- **Etapas** (`tracking.config.stages`):
  - Cada etapa tiene tipo, fechas, requerimientos y metas.
  - `LOSS_TYPES` = Pérdida de grasa, Mini cut y Preparación competencia.
  - Requerimientos (`s.reqs[idTipoDía]`): con `s.macroMode` ausente o `'g'` se anotan `{kcal, p, c, g}` en gramos y al lado se ve su g/kg. Con `'gkg'` se anotan `{pk, ck, gk}` en g/kg; los gramos salen del peso de referencia (`stageRefPeso`: peso inicial de la etapa o, si falta, el promedio de los 7 días previos, el de la 1.ª semana o el peso de Requerimientos) y las kcal se calculan solas. `stageTargets` resuelve ambos modos; al cambiar de modo (`setMacroMode`) se convierten los valores.
  - En gramos, las kcal se anotan a mano y la columna «Suma de macros» va sumando P×4 + C×4 + G×9 a medida que se escribe cada macro (parcial mientras falte alguno) y muestra la diferencia con las kcal anotadas.
  - «Copiar de la etapa anterior» (`copyPrevReqs`, desde E2) copia los `reqs` de la etapa i-1 y su `macroMode`; si la etapa ya tiene valores, pide confirmar.
  - Objetivos: «Copiar de la etapa anterior» (`copyPrevObjs`) copia los objetivos escritos de la etapa i-1. Si la etapa está vacía, los copia directo; si ya tiene objetivos, pregunta si sumarlos (sin repetir) o reemplazarlos.
- **Rangos de pérdida** (solo en etapas de pérdida):
  - `RANGOS`: `mod` (Moderado) va de 0,5 a 1 % semanal y `cons` (Conservador) de 0,3 a 0,5 %. `pers` usa `rmin` y `rmax`.
  - Bajo el rango se marca **Lento**, en azul (no significa malo). Dentro del rango, **Adecuado**. Sobre el rango, **Rápido**.
  - Los **tramos** `{desde, rango, rmin, rmax}` cambian el rango desde la semana n **dentro de la misma etapa**.
  - Las demás etapas usan % buscado ± tolerancia.
- **Semanas:**
  - `timeline(a)` arma las semanas por etapa (con caché en WeakMap). La semana 1 parte en la fecha de inicio de la etapa.
  - Hay una semana previa (`pre`) y bloques `gap` entre etapas.
  - Los datos semanales se guardan con la fecha ISO de inicio como clave (`wkKey`).
  - Una semana se evalúa con al menos 3 pesajes (`minWeighs`).
  - `prevInfo` compara con los 7 días anteriores; en la semana 1, si no hay pesajes, usa el peso inicial de la etapa. Si tampoco hay, busca el bloque de 7 días con pesajes más cercano, hasta 4 semanas atrás (`prevBlock`), y lleva el cambio a % por semana (`weeklyPct`).
  - **Datos incompletos:** con menos pesajes del mínimo, o comparando con un bloque más antiguo, el % se calcula igual (`logradoInfo().partial`, `rolling7().partial`) y se muestra con la marca «Faltan datos» (`partialTag`). La semana no se evalúa: el estado queda en gris y el mensaje da el % como referencia.
  - El Panel muestra `rolling7`, la media de 7 días frente a los 7 días anteriores.
  - El gráfico muestra una banda con el rango esperado (`expectedAt`) y la media móvil.
- **Menú diario:** el encabezado «total del día» compara la suma de las opciones ★ con las metas de la etapa elegida en «Metas de la etapa» (`menuStageOf`, guardada en `a.ui.menuStage`; por defecto, la vigente `currentStage`). Si no es la vigente, se avisa. La Distribución y el documento (minuta y distribución, en la vista previa y el PDF) usan esas mismas metas (`menuTargets`) y lo indican (`menuStageNote`). El resumen del atleta y el plan publicado al cliente siguen con la etapa vigente.
- **Opción por pasos** (`isSteps(o)`):
  - Es un tipo de opción de comida, junto a las normales (botón «Por pasos»). Si la comida solo tenía una opción vacía, la reemplaza.
  - `o.steps = [{ id, name, macro: 'c'|'p'|'g'|'kcal', sel, items: [{ id, foods: [línea…] }] }]`; `o.foods` queda vacío. Parte con Carbohidratos (c), Proteínas (p), Ensaladas (kcal) y Frutas (c), editables. Cada fuente (`item`) tiene uno o más alimentos.
  - En cada lista cuenta la fuente ★ (`sel`): `optLines(o)` da las líneas que suman (`optTotals`, total del día, Distribución). `optAllLines(o)` da todas (para imprimir y saber si un alimento se usa).
  - Cada fuente muestra su aporte, el % de la meta del día (etapa elegida) en el macro de su lista y la diferencia frente a la ★.
  - Al imprimir (`optPrint`) van todas las fuentes de cada lista («Carbohidratos · elige 1»); una fuente con varios alimentos va en una fila («Lechuga + Tomate»). Igual en el portal del cliente (`planSnapshot` incluye `steps`), el recetario y copiar/pegar.
  - Campo opcional: las opciones existentes no cambian, así que no hubo migración.
- **Recetario:**
  - Está en `S.recipes` y es global, compartido entre atletas.
  - Se guarda desde una opción del menú y se agrupa por tiempo de comida.
  - Se puede agregar como opción en cualquier comida de cualquier tipo de día.
  - Vista: `a.ui.menuView = 'dia' | 'recetas'`.
- **Descargar planificación:**
  - `planDocBody` dibuja la vista previa y `planPdfDef` arma el PDF.
  - `a.ui.docOff` lista los apartados que no se imprimen: `planif`, `cal`, `min:<idTipoDía>`, `dist` y `seg`. Los apartados se renumeran.
  - `a.ui.docStageOff` lista las ids de las etapas que no se imprimen (casillas «Etapas en la Planificación y el calendario»). `docStages` da las que se imprimen y `docStagesAll`, todas. Siempre queda al menos una, y cada etapa conserva su número (E2…). Si se desmarca alguna, el calendario (`calDocData`) solo muestra y cuenta los días dentro de las fechas de las etapas que se imprimen.
  - `a.ui.docMacros` (`docMac`): si es `true`, la minuta y la distribución muestran kcal y macros; por defecto no (el atleta solo ve alimentos y cantidades). La Planificación siempre muestra los requerimientos.
  - La primera hoja lleva la portada y el índice (`id: 'indice'`), con enlaces y número de hoja (`pageReference`) a cada apartado (`sec-<clave>`) y a cada minuta (`min-<idTipoDía>`). Cada apartado parte en hoja nueva y el pie de las hojas 2..N lleva «Volver al índice» (`pdfDoc(..., idx = true)`). Las ids de pdfmake no se pueden repetir en un documento.
  - Los datos bajo los títulos van en tablas, con los nombres arriba y los valores abajo: en cada etapa los requerimientos (una fila por tipo de día), el objetivo y los demás datos (`stageTables`), y el resumen del seguimiento (`docSegInfo`). Ambas vistas usan los mismos datos (`{head, rows, right}`): `infoTableHtml` para la vista previa e `infoTable` en `planPdfDef`.
  - La minuta va en horizontal.
  - Las cantidades largas usan la clase `mg-q-long`.
  - Si una minuta no cabe, la vista previa muestra «Ocupa N hojas en el PDF».
- **Base de alimentos:**
  - `addSeedFoods` agrega una sola vez los alimentos nuevos de `SEED_FOODS` desde el índice 150 (`SEED_BASE`), salvo que ya exista uno con el mismo nombre.
  - Para sumar alimentos a la base de todos los usuarios, **añádelos al final de `js/foods.js`**, nunca en medio.
- **Ingreso y selección de usuarios:**
  - El inicio de sesión usa usuario y clave provisorios (los conoce el usuario; la seguridad se verá después).
  - Tras ingresar se ve `viewSelect` (ruta `inicio`) con dos recuadros: Atletas y Población general.
  - Elegir un atleta lleva a su resumen (`atleta`, `viewHome`). Elegir un usuario de Población general lleva a `pg` (en blanco por ahora).
  - El menú superior empieza con «Usuarios» para volver a la selección (`ATH_ROUTES` define los apartados del atleta).
- **Portal del cliente:** solo funciona dentro del artifact de Claude; en GitHub Pages está en modo local.

## 6. Cargar un atleta desde planillas (Drive)
Los datos viven en el navegador del usuario, así que se pasan con un respaldo:
1. El usuario exporta un respaldo (⬇) y lo sube al chat junto con el enlace de la carpeta de Drive del atleta.
2. Lee las planillas: cuestionario, seguimiento, minuta e imágenes.
3. Con un script, fusiona **solo** el atleta indicado, que ya debe existir en la app; búscalo por nombre en `athletes[].q.nombre`.
4. Comprueba que los demás atletas, los alimentos y las recetas queden idénticos.
5. Prueba la importación en local y entrega el JSON con `SendUserFile`. El usuario lo importa con ⬆.

Criterios ya aprobados por el usuario:
- Los macros salen de la hoja de Seguimiento.
- Para etapas de pérdida: Moderado, y Conservador como tramo desde la semana en que la planilla pasa a 0,5 %.
- 12 semanas.
- Carga solo las opciones de menú completas. Si una opción completa no tiene nombre, ponle uno descriptivo.
- Un almuerzo "por pasos" va como una sola opción, con una combinación de referencia y las alternativas en notas. (Ahora existe la opción por pasos: pregunta al usuario si la usa al cargar planillas.)
- Si la planilla excluye la colación del total, usa «Sin colación (es opcional)» como opción principal ★.
- Las imágenes van como JPEG en data URL, de máximo 1400 px y calidad 82.
- Avisa al usuario de cualquier inconsistencia que encuentres sin corregirla por tu cuenta (macros que no cuadran, alimentos que el atleta no come, pesos distintos entre hojas).

## 7. Ideas pendientes (propuestas, ninguna pedida todavía)
- Campos semanales de ajuste y comentario del coach.
- Alertas de intervención y meta de adherencia.
- Escala diaria de hambre de 1 a 7.
- Cambios de macros con fecha dentro de una etapa, y rangos de macros.
- Panel: gráfico del % frente a la meta, pasos semanales, promedios de los últimos 7 días, variación de perímetros.
- Controles irregulares.
- Importar historial con revisión de los datos.
- Autorregistro del cliente fuera del artifact.
- Reglas para etapas de volumen y mantención.
- Que una minuta larga quepa en una hoja, por ejemplo con fotos más chicas.
- Convertir la «Fruta a elección» en líneas de alimento (ya existen Naranja y Mandarinas en la base).
