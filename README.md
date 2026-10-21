# LeiaNET — leianet.ar

Sitio web oficial de **LeiaNET (LeiaNETWORK)**, un hub para gamers y devs: utilidades web gratuitas (AI Compare, Steam In Linux, Steam Descuentos, Juegos gratis hoy, Minecraft Seeds y calculadoras, Conversor de sensibilidad, Can I Run IT?, Minecraft Server, Editor de Skins) y una red de servidores gratuitos de **Minecraft**, **Counter-Strike 1.6** y **Haxball**, hosteada de forma independiente. Todo es de uso libre, sin membresía.

🔗 **[leianet.ar](https://leianet.ar)**

---

## ✨ Qué tiene el sitio

- **Estado en vivo** de los servidores (online / offline / a medias) en la hero section.
- **Minecraft** — 1 servidor principal (anárquico y PVP, 1.12.2 – 26.2), con IP para copiar al toque. Hoy figura como "No disponible".
- **Counter-Strike 1.6** — Mixto activo; Only Dust2 y Deathmatch figuran como "No disponible".
- **Haxball** — 1 sala pública, con link directo para entrar.
- **Cafecito** — sección de apoyo económico al dominio, hosting e infraestructura.
- **FAQ** desplegable sobre el proyecto y cómo conectarse.
- **Redes sociales y contacto** (Discord, Instagram, X, TikTok, Twitch, WhatsApp, mail).
- Fondo animado con nebulosas, estrellas, planetas y un modo de **bajo rendimiento adaptativo** que se activa solo si detecta que el dispositivo lo necesita (menos animaciones, sin `backdrop-filter`, etc.).
- **Easter egg**: un minijuego escondido, **LeiaRUN** 🐕 (ver más abajo).

## 🐕 Easter egg — LeiaRUN (deshabilitado)

> Ahora el click en el logo abre **THE NETWORK · LeiaNET Edition** (Minecraft voxel, carpeta `leiamc/`). LeiaRUN sigue en el código pero desactivado; para reactivarlo definí `window.LEIARUN_ENABLED = true` antes de cargar `dog-runner.js`.

Haciendo click en el logo del header se abre un minijuego tipo *endless runner* (al estilo del dinosaurio de Chrome), protagonizado por un Border Collie que esquiva obstáculos espaciales.

- Código separado en `assets/dog-runner.js` y `assets/dog-runner.css` — no toca el resto del sitio.
- Controles: `ESPACIO` / `CLICK` / `TAP` para saltar, `ESC` para cerrar.
- Dificultad progresiva (velocidad y obstáculos más difíciles a medida que aumenta el puntaje), con mejor puntaje guardado en `localStorage`.
- **Soporte mobile**: si abrís el juego desde el celular en vertical, te pide girar el teléfono a horizontal antes de empezar (y pausa la partida si lo volvés a girar a mitad de juego).
- Mientras el juego está abierto se fuerza el modo de bajo rendimiento del sitio (nebulosas, brillo del cursor, etc. se apagan) para que no rame, y se restaura el modo que tenía el usuario al cerrar.

## 🌆 Modo Retrowave / Synthwave

Escribí **`retrowave`** en cualquier página (fuera de un input) para activarlo; volvé a escribirlo para desactivarlo.

- Escena propia: sol con franjas, montañas wireframe, estrellas y grilla en perspectiva animada, con la paleta `#200D3A #292651 #035EE8 #2DE2E6 #9700CC #F6019D #D40078 #F887FF #ECA089 #ECC6A2`.
- Se mantiene entre páginas (localStorage + `window.name` + `?retro=1` en los links internos) y la música (*Neon Highway*) sigue desde donde iba.
- Botones flotantes para silenciar la música y salir del modo. Es excluyente con el modo Aero.
- Logo neón propio (`logo_leianetwork_retro.webp`) en header y footer, igual que Aero usa el de vidrio; carretera, reflejo del sol, estrellas fugaces y parallax de scroll; reproductor con ecualizador.
- Archivos: `assets/retrowave-mode.js`, `assets/retrowave-mode.css`, `assets/retrowave-music.mp3`, fuente `assets/fonts/orbitron-*`.

## 🟩 Modo Matrix y 🪟 Modo Windows 95

Escribí **`matrix`** o **`win95`** en cualquier página (fuera de un input) para activarlos; volvé a escribir la palabra (o tocá el botón flotante) para salir.

- **Matrix**: fondo `#000000`, texto y bordes `#00ff00`, `#003300` para botones/inputs, `#80ff80` para resaltados. Lluvia de código en canvas, scanlines, tipografía Courier New, todo cuadrado.
- **Windows 95**: escritorio `#008080`, ventanas `#c0c0c0`, barras de título `#000080` → `#1084d0`, biseles `#fff / #808080 / #000`. Botones que se hunden al click, campos hundidos, barra de tareas con menú Inicio y reloj.
- Misma mecánica que Aero/Retrowave: se guarda entre páginas (localStorage + `window.name` + `?matrix=1` / `?win95=1` en los links internos) y los seis modos son excluyentes entre sí.
- Respeta `prefers-reduced-motion` y el modo de bajo rendimiento.
- **Música de fondo** en Matrix (`matrix-music.mp3`, ambient/techno oscuro) y Windows 95 (`win95-music.mp3`, instrumental estilo MIDI de época): loop con crossfade, volumen bajito, botón de silencio junto al de salida y se retoma desde donde iba al cambiar de página. Son composiciones originales sintetizadas (no hay samples de terceros).
- **Ladrido de Windows 95**: `assets/ladrido-8bit.wav` ahora es lo-fi a propósito (≈2,9 kHz, 4 bits, sin filtro anti-aliasing y con un poco de hiss); dura lo mismo que antes, así que la animación sigue sincronizada.
- Archivos: `assets/theme-modes.js` (todos estos modos + reproductor de música), `assets/matrix-mode.css`, `assets/win95-mode.css`.

## 🎮 Modo Game Boy y 🟨 Modo Brutalista

Escribí **`gameboy`** o **`brutal`** en cualquier página (fuera de un input); misma mecánica que el resto (se guardan entre páginas con `?gameboy=1` / `?brutal=1`, son excluyentes entre sí, respetan `prefers-reduced-motion` y el modo de bajo rendimiento).

- **Game Boy**: paleta de 4 verdes de la DMG (`#0f380f #306230 #8bac0f #9bbc0f`), pantalla LCD con grilla de píxeles y "ghosting" de refresco, tipografía monoespaciada en negrita, bordes gruesos y sombras duras, imágenes teñidas de verde, beep "ba-ding" al activar. Música chiptune (`gameboy-music.mp3`: pulsos, triángulo y ruido).
- **Brutalista** (neobrutalismo): fondo crema con puntos, figuras planas flotando, bordes de 3 px, sombras duras que se hunden al click, tarjetas que rotan entre amarillo/rosa/azul/verde y títulos con marcador. Música funk (`brutal-music.mp3`).
- Ambos usan el botón flotante de salida + botón de música, y el ladrido del logo tiene burbuja propia en cada estilo.
- Archivos: `assets/theme-modes.js`, `assets/gameboy-mode.css`, `assets/brutal-mode.css`, `assets/gameboy-music.mp3`, `assets/brutal-music.mp3`.

## 🕯️ Modo Dark Fantasy

Escribí **`darkfantasy`** en cualquier página (fuera de un input); misma mecánica que el resto (se guarda entre páginas con `?darkfantasy=1`, es excluyente con los demás modos, respeta `prefers-reduced-motion` y el modo de bajo rendimiento).

- **Paleta**: `#201a32 · #4e3c5d · #896991 · #e5a4c7 · #f5c2d9` (ciruela nocturno → malva → rosa pálido). Sin naranjas ni rojos: tono sombrío, no festivo.
- **Escena**: cielo violeta con Vía Láctea y estrellas titilantes, eclipse, montañas dentadas en capas con niebla, árboles muertos y un acantilado con muralla y torres con techo de hongo (ventanas y puntos de luz que parpadean, estandarte, braseros mágicos, cuervos). Motas de luz que suben, estrella fugaz ocasional y parallax suave con el mouse.
- **Interfaz**: tarjetas de piedra oscura con marco grabado, títulos serif en mayúsculas con subrayado degradé, botones ciruela con brillo malva, foco de teclado rosa pálido. Logo y ladrido teñidos de malva.
- **Música**: `darkfantasy-music.mp3`, ambient oscuro original sintetizado (drone, pads, campanas y tambor grave), con botón de silencio.
- Archivos: `assets/theme-modes.js`, `assets/darkfantasy-mode.css`, `assets/darkfantasy-music.mp3`.

## 📊 Encuestas (sección Novedades)

Las encuestas se muestran arriba de las novedades y se crean desde `admin.html` (mismo token que las novedades).

- Pregunta + **3 opciones**, voto de **una sola opción** o **múltiple choice**.
- **Duración configurable** (30 min, 1 h, 6 h, 12 h, 24 h, 3 días, 1 semana o personalizada, hasta 30 días).
- Al votar se ven **votos y porcentaje** de cada opción. Al vencer: `VOTACIÓN CERRADA. GANADOR: …` (con empate o sin votos también lo aclara).
- Desde el admin se puede **cerrar antes de tiempo** o borrar una encuesta.
- En múltiple choice el % es sobre la cantidad de votantes, así que puede sumar más de 100.

Archivos: `assets/encuestas.js` + `assets/encuestas.css` (home) y el bloque de encuestas dentro de `admin.html`.

### Backend

El sitio es estático, así que los votos se guardan en el backend de novedades (`novedades.leianet.ar`).
El módulo es `encuestas.js` (**no se sube a GitHub Pages**, va en el servidor del puerto 3002; no tiene dependencias):

```js
const encuestas = require('./encuestas');
app.use('/api/encuestas', encuestas({ adminToken: process.env.NOVEDADES_TOKEN }));
```

Guarda todo en `encuestas.json` junto al módulo (hacer backup de ese archivo). Requiere Node 18+.

### Anti-bots

Todo se valida en el servidor: proof-of-work firmado de un solo uso (la dificultad sube si una IP insiste), tiempo mínimo entre pedir el desafío y votar, honeypot, un voto por dispositivo, tope de votos por IP y encuesta, rate-limit, filtro de User-Agents de scripts y chequeo de Origin. Las IPs se guardan hasheadas.
Opcional y recomendado si aparece abuso real: **Cloudflare Turnstile** (`TURNSTILE_SECRET` en el backend y `window.LEIA_TURNSTILE_SITEKEY` antes de `encuestas.js`).

---

## 🗂️ Estructura del proyecto

```
.
├── index.html              # todo el sitio (HTML + CSS + JS del sitio principal)
├── 404.html                 # página de error 404
├── CNAME                    # dominio custom para GitHub Pages (leianet.ar)
├── robots.txt
├── sitemap.xml
├── llms.txt                 # resumen del sitio para agentes/LLMs
└── assets/
    ├── dog-runner.js         # lógica del minijuego easter egg (LeiaRUN)
    ├── dog-runner.css        # estilos del minijuego
    ├── dog_run1.png / dog_run2.png / dog_jump.png / dog_sad.png   # sprites del perro
    ├── obstacles/             # sprites de los obstáculos del minijuego
    ├── saltar.mp3, musica.mp3, clicksound.mp3, volversound.wav    # sonidos
    ├── logo_*.webp, icon_*.webp, favicon-*.png                    # branding e íconos
    └── ...
```

Es un sitio **100% estático**: no hay build step, framework ni dependencias — se edita `index.html` (y los archivos de `assets/`) directamente.

## 🚀 Desarrollo local

No hace falta ningún setup especial. Alcanza con abrir `index.html` en el navegador, o levantar un servidor estático simple para evitar problemas de rutas relativas:

```bash
# con Python
python3 -m http.server 8000

# con Node
npx serve .
```

Después entrás a `http://localhost:8000`.

## 🌐 Deploy

El sitio se sirve con **GitHub Pages** apuntando al dominio custom `leianet.ar` (configurado en el archivo `CNAME`). Cualquier push a la rama principal se refleja en producción — puede tardar uno o dos minutos en propagarse, y conviene forzar refresh de caché al probar cambios en `assets/` (JS/CSS suelen quedar cacheados por el navegador).

## 🤝 Contacto y comunidad

- Discord: [discord.gg/3Hsy6JrSMH](https://discord.gg/3Hsy6JrSMH) — reportes de bugs, anuncios y soporte.
- Mail: soporte@leianet.ar
- Instagram: [@leia_network](https://www.instagram.com/leia_network/) · X: [@leianetwork](https://twitter.com/leianetwork) · TikTok: [@leianetwork](https://www.tiktok.com/@leianetwork) · Twitch: [leian3t](https://twitch.tv/leian3t)

Si querés apoyar el proyecto (dominio, hosting e infraestructura), podés invitar un cafecito en [cafecito.app/leianet](https://cafecito.app/leianet).

---

© LeiaNET — proyecto independiente, sin fines de lucro.

## 🫧 Modo Aero (Frutiger Aero 2007)

Escribí **`aero`** con el teclado en cualquier página (fuera de un campo de texto) o tocá el botón 🫧 abajo a la derecha: el sitio pasa a estilo Frutiger Aero (cielo, vidrio líquido, botones glossy, burbujas y colinas) con música ambiente generada con WebAudio (botón 🎵 para silenciar). Se guarda en `localStorage` y se mantiene entre páginas. Archivos: `assets/aero-mode.css` + `assets/aero-mode.js`.
