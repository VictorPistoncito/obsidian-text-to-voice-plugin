# Contexto del proyecto: IA personalizada para dictar notas en Obsidian

## 1. Idea del proyecto

Desarrollar un plugin de Obsidian que permita dictar texto por voz y convertirlo en entradas del vault, con capacidad de revisión antes de guardar y sugerencia de conexiones (enlaces) con otras notas existentes.

**Objetivo principal del proyecto: aprender a desarrollar productos con IA**, no solo obtener la funcionalidad (que en parte ya existe con plugins de la comunidad). Por eso se ha optado por construir un plugin propio en vez de usar únicamente soluciones ya hechas, priorizando las partes que representan un reto de ingeniería real.

### Funcionalidad completa deseada

1. **Dictado y limpieza**: el usuario dicta texto por voz; se transcribe y se limpia de muletillas, tartamudeos y repeticiones (vía LLM).
2. **Edición iterativa por voz**: el texto limpio se muestra en pantalla en un estado de "borrador" (aún no guardado en el vault). El usuario puede, por voz, seguir modificándolo: añadir, sustituir o eliminar texto, así como aplicar formato Markdown (títulos, negrita, listas, etc.) mediante comandos hablados. Este ciclo se repite tantas veces como el usuario quiera.
3. **Conexiones con otras notas (opcional)**: una vez finalizado el texto, se ofrecen sugerencias de enlace con otras entradas del vault según similitud de contenido/palabras clave. El usuario decide cuáles aceptar.
4. **Guardado**: solo al confirmar, el texto final (con los enlaces aceptados) se escribe en el vault.

## 2. Decisiones de arquitectura tomadas

- **No se va a depender de los plugins existentes como cajas negras** (Whisper, Smart Connections) para las partes clave, precisamente porque el objetivo es aprender construyendo. Se usan como referencia o como piezas de apoyo puntual, no como dependencia central.
- **Se construye un plugin de Obsidian propio, en TypeScript**, con pipeline propio de captura de audio → transcripción → limpieza → edición iterativa → conexiones → guardado. Ningún paso escribe en el vault hasta el paso final (estado 4).
- **Uso de Smart Connections como referencia/fuente de datos**: sus embeddings se guardan como JSON en la carpeta `.smart-env/` del vault, legible directamente. Se puede leer esa carpeta para obtener candidatos de notas similares sin necesidad de reimplementar embeddings desde cero. Opcionalmente, existe también un modo más acoplado accediendo a su API pública expuesta (`app.plugins.plugins['smart-connections']`), no explorado aún.
- **`editInterpreter.ts`** (la pieza que interpreta las instrucciones de edición por voz y las aplica al borrador): de momento se deja resuelto **enteramente por el LLM** (se le manda el texto actual + la instrucción hablada y devuelve el resultado). Se decidió explícitamente NO optimizar esto todavía con reglas/algoritmos propios — se evaluará más adelante, iterando sobre el proyecto, si conviene sustituir parte de la lógica por algo más determinista (por ejemplo, que el LLM devuelva operaciones estructuradas tipo `{accion, buscar, con}` en vez de reescribir el texto completo cada vez).

### Estructura de carpetas planteada

```
tu-plugin/
├── main.ts
├── manifest.json
├── src/
│   ├── audio/
│   │   ├── recorder.ts
│   │   └── transcriber.ts        # llamada a Whisper API
│   ├── llm/
│   │   ├── cleaner.ts             # limpieza inicial (muletillas, etc.)
│   │   └── editInterpreter.ts     # interpreta instrucciones de edición por voz (resuelto vía LLM por ahora)
│   ├── ui/
│   │   └── DraftView.ts           # vista con el texto + controles + sugerencias
│   ├── connections/
│   │   └── smartEnvReader.ts      # lee .smart-env/ para sugerir enlaces
│   └── vault/
│       └── writer.ts              # solo se llama al confirmar (estado guardado)
└── state/
    └── draftStore.ts               # estado en memoria del borrador actual
```

### Máquina de estados del flujo

```
[1. GRABANDO] → [2. BORRADOR / EDICIÓN] → [3. CONEXIONES] → [4. GUARDADO]
```

## 3. Tecnologías

- **TypeScript** + **Obsidian API** (`Plugin`, `Vault`, `ItemView`/`Modal`, `Editor`, Settings tab).
- **Node.js / npm** para compilación (esbuild, configurado en `esbuild.config.mjs`), ya instalado Node v24.19.0.
- **esbuild** en modo watch (`npm run dev`) para recompilar `main.ts` → `main.js` automáticamente.
- **MediaRecorder API** (nativa del navegador/Electron) para captura de audio, sin necesidad de librerías externas.
- **API de Whisper** (OpenAI/Groq/Azure, o local vía Ollama/servidor local) para transcripción de voz a texto.
- **API de Claude** (LLM) para: limpieza de texto dictado, interpretación de instrucciones de edición por voz, y (más adelante) clasificación del tipo de relación entre notas.
- **Git / GitHub**: proyecto forkeado desde `obsidian-sample-plugin` (repo oficial de plantilla de plugins de Obsidian).
- Referencia externa: plugin **Smart Connections** (open source) para lectura de embeddings/similitud vía `.smart-env/`.
- Entorno de desarrollo: Windows, Git Bash (MINGW64), VS Code.

## 4. Avances hasta el momento

1. Repositorio `obsidian-sample-plugin` forkeado en: `C:\Users\victo\source\repos\obsidian-text-to-voice-plugin`.
2. Vault de pruebas creado y movido a: `D:\Obsidian\Plugin voz` (se movió desde `D:\Program Files\Plugin voz` por sospecha de conflicto con antivirus/permisos, descartado luego como causa raíz).
3. Symlink creado (`ln -s` desde Git Bash, ejecutado como administrador, con "Modo para desarrolladores" activado en Windows) entre la carpeta del proyecto y `<vault>/.obsidian/plugins/obsidian-text-to-voice-plugin`.
   - El symlink resultó ser, según todo indicio, una **junction de Windows** (no un symlink Unix puro) — `ls -la` y `stat` lo muestran como `directory` normal, sin la `l` ni la flecha `->` típica.
   - Verificado que **sí funciona parcialmente**: archivos creados/leídos/borrados desde ambos lados (proyecto real ↔ carpeta del vault) se propagan correctamente para archivos "normales" (`manifest.json`, `prueba.txt`, etc.).
4. Node.js v24.19.0 instalado y funcionando; `npm install` ejecutado con éxito (generó `node_modules/`).
5. `npm run dev` ejecutándose correctamente, esbuild en modo watch, compilación exitosa confirmada (`[watch] build finished, watching for changes...`).
6. Confirmado que `main.js` **sí se genera correctamente** en la raíz del proyecto real (`/c/Users/victo/source/repos/obsidian-text-to-voice-plugin/main.js`), sin archivos temporales raros asociados.
7. El plugin aparece listado en Obsidian (`Configuración → Community plugins`) con el nombre "Sample Plugin", confirmando que `manifest.json` sí se lee correctamente a través del symlink/junction.

## 5. Dificultad actual (sin resolver)

**El archivo `main.js` específicamente no es accesible a través del symlink/junction**, aunque el resto de archivos del proyecto sí lo son:
- `ls -la` y `stat` no muestran `main.js` en el listado del lado del vault.
- `cat` y `wc -l` sobre la ruta del vault dan error "No such file or directory" para `main.js` en concreto.
- No hay archivos temporales (`.tmp`, etc.) asociados a la escritura de esbuild que expliquen un problema de rename.
- El resto de operaciones (crear, leer, borrar archivos de prueba) funcionan con normalidad en ambas direcciones a través del enlace.
- Por esto, el toggle para activar el plugin en Obsidian no responde: Obsidian lee `manifest.json` (por eso el plugin aparece listado), pero al intentar activarlo necesita cargar y ejecutar `main.js`, que no logra leer a través del enlace → de ahí que la activación falle silenciosamente sin mostrar error claro en la consola de DevTools.

**Hipótesis no confirmada**: podría estar relacionado con cómo Windows maneja los descriptores de archivo que esbuild deja abiertos al escribir sobre una junction, o con alguna diferencia de comportamiento entre `mklink /J` (junction) y `mklink /D` (symlink de directorio) — no explorado aún, ya que `ln -s` desde Git Bash no deja elegir explícitamente cuál de los dos crea.

**Alternativa ya identificada pero no implementada** (el usuario prefiere seguir investigando el symlink antes de recurrir a ella): modificar `esbuild.config.mjs` para que copie automáticamente `main.js`, `manifest.json` y `styles.css` a la carpeta del vault tras cada build, en vez de depender de que Obsidian los lea a través del enlace.

## 6. Trabajo por hacer

- [ ] Resolver el problema de `main.js` no accesible a través del symlink/junction (o decidir migrar a la solución de copia automática vía script en `esbuild.config.mjs`).
- [ ] Conseguir activar el plugin de ejemplo en Obsidian y validar el flujo básico end-to-end (icono en ribbon, comando de paleta, modal de ejemplo).
- [ ] Editar `manifest.json` con el `id`, nombre y descripción definitivos del proyecto.
- [ ] Implementar `recorder.ts` (captura de audio vía `MediaRecorder`).
- [ ] Implementar `transcriber.ts` (llamada a la API de Whisper).
- [ ] Implementar `cleaner.ts` (limpieza de muletillas/tartamudeos vía LLM).
- [ ] Implementar `DraftView.ts` (vista de borrador editable).
- [ ] Implementar `editInterpreter.ts` (interpretación de instrucciones de edición por voz vía LLM — sin optimización con reglas propias por ahora).
- [ ] Implementar `smartEnvReader.ts` (lectura de `.smart-env/` para sugerencias de notas relacionadas).
- [ ] Implementar `writer.ts` (escritura final en el vault).
- [ ] Definir la taxonomía de tipos de relación entre notas (causa-efecto, contradicción, ejemplo, etc.) — pendiente de abordar más adelante, es una funcionalidad adicional sobre las sugerencias de Smart Connections.
- [ ] Definir el formato exacto en que se guardan las relaciones tipadas en las notas (frontmatter YAML vs. archivo separado) — pendiente de decidir.
- [ ] Settings tab del plugin para configurar API keys (Whisper, Claude) sin hardcodearlas.
- [ ] Instalar plugin "Hot Reload" para agilizar el ciclo de desarrollo.
