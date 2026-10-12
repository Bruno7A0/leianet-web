# THE NETWORK · LeiaNET Edition

Sandbox voxel 3D procedural. JavaScript (ES modules) + WebGL2, sin dependencias ni archivos de imagen/audio (texturas y sonidos se generan por código).

## Ejecutar

    python3 serve.py        (Windows: python serve.py)
    # o
    node serve.js

Abre http://localhost:8000/. Parámetros opcionales: `?seed=mundo` · `?mode=creative`.
Para ver el easter egg dentro de una página: http://localhost:8000/demo.html

## Usarlo como easter egg en tu web

1. Copiá esta carpeta completa a tu sitio (por ejemplo `/voxelia/`).
2. En tu página agregá una línea:

       <script src="/voxelia/voxelia-egg.js" data-src="/voxelia/index.html" defer></script>

3. Se activa con: código Konami (↑↑↓↓←→←→BA) o escribiendo `thenetwork`.

Opciones por atributo: `data-word="otra-palabra"` (o `"false"`), `data-konami="false"`, `data-click-selector="#logo" data-click-count="5"`, `data-seed`, `data-mode="creative"`.
Por JS: `VoxeliaEgg.init({...})` y `VoxeliaEgg.open()` (por ejemplo desde un botón). El juego vive en un iframe que se crea recién al activarlo, así que no pesa nada hasta entonces.

## Controles

WASD mover · Ratón mirar · Espacio saltar/nadar · Shift agacharse · doble W correr · clic izq. romper (mantener) · clic der. colocar · rueda clic copiar bloque · 1-9 / rueda elegir ranura · E inventario y fabricación · G modo creativo (doble espacio = volar) · M silenciar · F3 datos · Esc pausa (con el inventario abierto, Esc o E lo cierran y vuelven directo al juego, sin pausa).
Antorcha: carbón sobre palo. Horno: 8 rocas en anillo; clic der. para usarlo (entrada arriba, combustible abajo).
Clic izq. sobre TNT lo enciende (Shift+clic lo rompe). Clic der. sobre una mesa de crafteo abre la grilla 3x3.

## Fabricación (v0.4)

- Empezás en supervivencia con 10 troncos, una mesa de crafteo y 4 TNT.
- **E** abre el inventario (36 ranuras + grilla 2x2). Clic izq. toma/coloca todo, clic der. toma la mitad o coloca uno, Shift+clic mueve entre hotbar e inventario.
- Tronco → 4 tablones · 2 tablones (vertical) → 4 palos · 4 tablones (2x2) → mesa de crafteo.
- En la mesa (3x3): pico `MMM / _S_ / _S_`, hacha `MM / MS / _S`, pala `M / S / S`, espada `M / M / S`, con M = tablones, roca, lingote de hierro, lingote de oro o diamante (las recetas se pueden espejar).
- 20 herramientas con durabilidad y nivel: piedra necesita pico de madera, hierro pico de piedra, oro y diamante pico de hierro, obsidiana pico de diamante. El hierro y el oro sueltan lingotes y el diamante suelta diamante.
- TNT: 4 carbón + 4 arena en cruz. Librería: 6 tablones y 3 vidrios.
- En modo creativo (G) el inventario muestra además una paleta con todos los bloques e ítems.

## Novedades v0.3

- Árboles, grava, bedrock, oro, diamante y obsidiana; 11 bloques nuevos (roca, TNT, mesa de crafteo, librería, piedra luminosa…).
- Ciclo día/noche (10 min) con sol, luna, estrellas y atardeceres; los bloques luminosos brillan de noche.
- Romper bloques lleva tiempo según su dureza, con grietas progresivas y partículas.
- TNT con mecha y reacción en cadena, explosiones con cráter, retroceso y sacudida de pantalla.
- Vida con corazones, daño por caída, regeneración, pantalla de muerte.
- Natación, vuelo en creativo, niebla bajo el agua.
- Sonido sintetizado (romper, colocar, pasos, silbido, explosión…).

## Tests

    npm test

## Estructura

    src/blocks/     registro de bloques + atlas de texturas generado por código
    src/world/      Chunk, World, raycast, explosiones
    src/terrain/    ruido Perlin y TerrainGenerator (árboles, menas)
    src/rendering/  mesher, Renderer WebGL2 (cielo, lotes dinámicos) y Batch
    src/fx/         ciclo día/noche, partículas, audio
    src/player/     Player (física, nado, vuelo) e Input
    voxelia-egg.js  disparador del easter egg para tu página

## LeiaNET Edition (v0.5)

- Tema visual de leianet.ar: tipografías, paleta, logo, perro corriendo en la carga y perro triste al morir.
- Bloques: **Bloque LeiaNET** (logo "L", luminoso), **Bloque Leia (collie)**, lana blanca/negra/rosa/verde/marrón.
- **Mural** de la mascota (56×56 de lana, con ojos marrones y lengua rosa) flotando en el aire frente al spawn; se limpian los árboles del camino.
- Bordes suaves: MSAA 4x propio (`?msaa=0|2|4|8`), mipmaps para el atlas e interpolación `centroid` de las UV (evita que se cuele el color de bloques vecinos).
- Música de fondo (`assets/musica.mp3`, "Forgotten Block") que se repite con fundido cruzado para que nunca termine; **M** silencia todo.
- Los materiales se leen de `assets/` (incluida en este zip). `src/leianet/assets.js` los carga y parchea el atlas;
  si no están, el juego usa texturas procedurales. Parámetros: `?assets=`, `?music=0`, `?msaa=`, `?dog=0`, `?debug=1` (expone `window.__vx`).

## v0.6 · Celular, guardado y rendimiento

**Controles táctiles** (se activan solos en pantallas táctiles; `?touch=1` / `?touch=0` para forzar)
- Joystick flotante a la izquierda (empujalo hasta el borde para correr) · arrastrar en el resto de la pantalla para mirar.
- Botones: ⛏ romper (mantener) · ▣ colocar / usar · ▲ saltar (doble toque = volar en creativo) · ▼ agacharse (se queda apretado) · 🎒 inventario · ❚❚ pausa.
- Tocar una ranura de la hotbar la elige. En el inventario hay "½ Mitad" (equivale al clic derecho) y "✕ Cerrar"; el panel se achica para entrar en pantallas chicas.
- En vertical pide girar el teléfono (y pausa). Al empezar intenta pantalla completa y bloquear horizontal.
- Disparador del easter egg en celular: `data-click-selector="#logo" data-click-count="5"` (5 toques seguidos al logo).

**Guardado** (localStorage, por semilla; `?save=0` lo desactiva)
- Guarda sólo los bloques que cambiaste respecto del terreno generado (un cráter o una casa pesan pocos KB) + posición, vida, hora, modo e inventario.
- Autoguardado cada 20 s, al pausar, al cerrar el inventario, al morir, al ocultar la pestaña y al cerrar el juego desde la web.
- "Mundo nuevo" en el menú de pausa (pide confirmar con un segundo toque) borra el guardado.
- Si el almacenamiento está lleno o bloqueado avisa una vez y el juego sigue.

**Rendimiento** (botón "Rendimiento" en la pausa: Auto → Alto → Medio → Bajo; `?perf=high|mid|low`)
- Alto: MSAA 4x, resolución hasta 2x, 8 chunks de distancia. Medio: 2x, 1.5x, 6. Bajo: sin MSAA, 1x, 4, menos partículas.
- Auto arranca en Medio en celulares / equipos de ≤4 núcleos o ≤4 GB, y en Alto en el resto; si los FPS promedian < 28 de forma sostenida baja un nivel (nunca sube solo).
- Si la web está en su modo de bajo rendimiento, el cargador abre el juego con `?perf=low`. Detecta las clases `low-perf`, `lowperf`, `low-performance`, `perf-low`, `low-power` (o `data-perf="low"`) en `<html>`/`<body>`;
  se puede indicar la propia con `data-low-perf="mi-clase"` o `VoxeliaEgg.init({ lowPerf: () => ... })`.
- Mientras el juego está abierto, `lowPerfClass` (p. ej. `data-low-perf-class="low-perf"`) se agrega a `<html>` para que la web también se aligere, y se quita al cerrar. También hay `onOpen` / `onClose`.

## v0.7 · Mundo grande, biomas y cuevas

**Un mundo distinto cada vez, y fijo una vez guardado**
- Sin `?seed=`, la primera vez que se abre se elige una semilla al azar. Desde el primer guardado ese pasa a ser "el mundo" de ese navegador y se vuelve a abrir siempre igual.
- "Mundo nuevo" en la pausa borra el guardado y el recuerdo del mundo: la próxima apertura es otro mundo al azar.
- `?seed=algo` (o `data-seed`) fuerza una semilla fija para todos y no toca el mundo recordado.
- La clave del guardado incluye la versión del generador (`leianet.network.v2:<semilla>:<s|c>`); los guardados de la v0.5/0.6 no se aplican porque el terreno cambió.

**Mundo de 512 × 512 bloques (32 × 32 chunks)**
- Antes de empezar se genera un radio de 4 chunks; el resto se genera mientras caminás (radio según la calidad) y lo lejano que no editaste se descarga, así la memoria no crece. El borde del mundo avisa con un cartel.
- Lo que editaste nunca se descarga y es lo único que se guarda (diferencia por chunk contra el terreno generado). Los chunks guardados que todavía no se generaron esta sesión esperan en una lista y se aplican cuando aparecen.
- El mural del collie y la galería creativa se "estampan" al generar cada chunk (así sobreviven a la descarga). Siempre aparecés en pradera o bosque, con sitio para el mural.

**Biomas** (temperatura + humedad + relieve): pradera, bosque (árboles densos), desierto (arena y cactus), nieve (bloque de nieve, árboles con gorro de nieve), montañas (piedra y nieve arriba), playa y océano. Bloques nuevos: Nieve y Cactus. F3 muestra el bioma.

**Cuevas**: túneles tipo "espagueti" (dos ruidos 3D) y cavernas amplias abajo; no perforan el fondo del mar y nunca hay cuevas bajo el punto de aparición. Las caras subterráneas van a una malla aparte que sólo se dibuja si estás bajo tierra o a menos de 30 bloques, así las cuevas no cuestan triángulos en la superficie.

## v0.8 · Sonidos sintetizados por superficie y acción

Todo se genera con WebAudio (ruido filtrado + tonos), sin archivos de audio. Cada superficie tiene su "receta" de paso en `src/fx/audio.js` (`STEP`) y el resto de las acciones salen de ella:

- **Superficies**: pasto (roce + golpe sordo), tierra (golpe grave), arena (siseo), grava (crujido en granos), piedra (golpe seco; minerales y ladrillos también), madera (toc hueco), nieve (crujido apretado), hojas, lana (almohadón), vidrio (tintineo), cactus y agua (chapoteo si tenés los pies en el agua).
- **Acciones**: paso (alterna izquierda/derecha; agachado no suena), salto, caída (golpe grave), golpes mientras picás, romper (3 golpes que se apagan; el vidrio se hace trizas y la madera cruje), colocar, recoger lo que soltó el bloque.
- **Interfaz**: abrir/cerrar inventario, mesa de crafteo (madera que cruje), clic en menús y casillas, fabricar, cambiar de ranura, activar/desactivar vuelo, brazadas al nadar, muerte.
- Cada reproducción varía un poco el tono y el volumen. Los niveles están calibrados midiendo el render de cada sonido (pasos ≈ 0,12 de pico, romper ≈ 0,35).
- Para agregar una superficie: sumá una receta en `STEP`, un valor en `GAIN` y asignala en `MATERIAL`.

## v0.8.1 · Mano e interfaz

- **Mano**: cada ítem plano se agarra según su tipo (`src/fx/hand.js`): la antorcha va parada con la llama arriba, herramientas y palos por el mango, lingotes y diamantes por el centro. `tests/hand.test.mjs` verifica que ningún ítem/bloque genere geometría inválida.
- **Esc / E con el inventario abierto** cierran directo al juego (antes saltaba el menú de pausa). Si el navegador no deja recapturar el ratón, aparece el cartel "Hacé clic para volver al juego".
- **Interfaz de inventario, mesa de crafteo y horno** rediseñada: casillas con relieve, secciones rotuladas, tooltips con nombre y durabilidad, casilla de resultado que se ilumina cuando hay receta, horno con "Material / Combustible / Resultado", paleta creativa con buscador, `1`–`9` sobre una casilla la manda a la barra rápida, y el panel se escala solo si la ventana es chica.

## Zombis (v0.5)
De noche aparecen zombis en superficie: te persiguen y golpean (1.5 ♥). Clic izq. para atacar (las espadas hacen más daño). De día se queman. No aparecen en creativo.

## Hambre, comida y cama (v0.6)
- Barra de hambre (10 muslos) a la derecha de la hotbar. Baja con el tiempo (más rápido corriendo). Con hambre ≥ 14 regenerás vida; con menos de 6 no podés correr; en 0 te vas debilitando (hasta 1 ♥).
- Comer: clic der. con comida en la mano. **Manzana** (+2 muslos): la sueltan las hojas, empezás con 4. **Carne cruda** (+1): la sueltan los zombis. **Carne cocida** (+4): carne cruda en el horno.
- **Cama**: 3 lanas + 3 tablones (`WWW / PPP`). La lana verde sale de fundir cactus. Clic der.: guarda tu punto de reaparición; de noche además duerme hasta el amanecer. Si la cama se rompe, reaparecés en el spawn original.
