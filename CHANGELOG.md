## 2026-10-20 · Nueva utilidad: Minecraft Seeds y calculadoras
- **Minecraft Seeds y calculadoras** (`minecraft-seedmap.html`, `assets/minecraft-seedmap.css|js`, `assets/seedmap-worker.js`, `assets/seedmap.wasm`): mapa de seeds de Minecraft Java con arrastre y zoom (biomas en español, estructuras, strongholds, spawn y slime chunks; Overworld, Nether y End; 1.16.5 a 1.21.x) más calculadoras de coordenadas Overworld↔Nether y de stacks/shulkers. Generación con [cubiomes](https://github.com/Cubitect/cubiomes) (MIT, licencia en `assets/cubiomes-LICENSE.txt`) compilado a WebAssembly (`tools/seedmap/`), en un Web Worker. Sin API ni backend. Limitación: en 1.18+ algunas estructuras pueden aparecer sin generarse en el juego.

## 2026-10-20 · Nuevas utilidades: Opciones de lanzamiento y Chuleta de comandos Linux
- **Opciones de lanzamiento** (`launch-options.html`, `assets/launch-options.css|js`): generador de la línea de lanzamiento de Steam para Linux (GameMode, MangoHud, Gamescope, variables de Proton/DXVK, GPU dedicada, presets).
- **Chuleta de comandos Linux** (`chuleta-linux.html`, `assets/chuleta-linux.css|js`): más de 150 comandos con buscador, filtros, copia con un toque y marca ⚠ en los peligrosos.

## 2026-10-20 · Nueva utilidad: Conversor de sensibilidad
- **Conversor de sensibilidad** (`sensibilidad.html`, `assets/sensibilidad.css|js`): pasás juego (CS 1.6/CS:GO/CS2, Valorant, Apex, Overwatch 2), sensibilidad y DPI y devuelve la equivalente en los otros juegos con su eDPI y los cm por giro de 360°. Opción de DPI destino distinto, redondeo a los decimales de cada juego (con la diferencia a la vista), botón copiar y último valor guardado en `localStorage`. Solo matemática en el navegador: sin API ni backend. Tarjeta en Utilidades (index y utilidades.html), sitemap y llms.txt.

## 2026-10-20 · Nueva utilidad: Juegos gratis hoy
- **Juegos gratis hoy** (`juegos-gratis.html`, `assets/juegos-gratis.css|js`): giveaways activos de GamerPower (Steam, Epic, GOG, Ubisoft, itch.io, consolas, móvil) en listas: terminan pronto, juegos completos, DLC y extras, acceso anticipado. Muestra valor, vencimiento y filtros por plataforma y nombre; descarta vencidos y links que no sean https. Cache de 10 min en `sessionStorage`. Tarjeta en Utilidades (index y utilidades.html), sitemap y llms.txt.

## 2026-10-20 · Nueva utilidad: Steam Descuentos
- **Steam Descuentos** (`steam-descuentos.html`, `assets/steam-descuentos.css|js`): listas con las mejores ofertas de Steam (gratis por tiempo limitado, mejores ofertas, mayores descuentos, más populares, joyas por menos de US$ 10 y grandes lanzamientos), filtros por descuento mínimo, precio máximo y nombre. Datos de CheapShark (precios en USD), cache de 15 min en `sessionStorage`. Tarjeta en Utilidades (index y utilidades.html), sitemap y llms.txt.

## 2026-10-20 · Nueva utilidad + funciones restauradas sobre la UI anterior
- Nueva utilidad **Tienda de Fortnite** (`fortnite.html`, `assets/fortnite-shop.css|js`): secciones de la tienda de hoy con precio en PaVos y rareza. Tarjeta en Utilidades (index y utilidades.html).
- UI del inicio vuelta a la versión previa a `1cb620a` (sin el perro separador ni la división Utilidades/Juegos/Servidores/Web).
- Restaurados sobre esa UI: estado de **Backends** en el hero, sección **Sugerencias** (+ moderación en `admin.html`), **modo Pixel Art** y ladrido pixel art (sprite y audio 8 bits).

# Changelog — bugs reales

- **Pantalla en blanco si `load` tarda**: failsafe solo en JS (muestra la página 0,8 s después de DOMContentLoaded, o a los 3 s como tope). Se quitó el failsafe CSS por animación (podía causar pantalla negra).
- **Modo "ultra" falso cacheado 6 h**: la medición de FPS espera a que la pestaña sea visible y descarta la ronda si se oculta.
- **FAQ trabado**: timer de respaldo si `transitionend` no dispara; se limpian listeners/timers al reabrir rápido.
- **Botón copiar**: el HTML original se guarda una vez (doble click ya no deja "Copiado"); fallback `textarea` con `position:fixed` + `preventScroll`.
- **Cards caídas**: botones con `tabindex="-1"` y `aria-disabled`; el handler los ignora.
- **Badge "NO DISPONIBLE"**: excluido del `filter` del padre (`:not(.lock-overlay)`).
- **Parallax de estrellas**: pasa a la propiedad `translate` (ya no lo pisa `drift-slow`).
- **Doble divisor**: se quita el `border-top` sólido de `section.game`.
- **Estrellas 4K/ultrawide**: lienzo calculado según pantalla, con densidad compensada.

## Seguridad (Novedades)
- `escapeHtml` escapa `& < > " '`; `fecha` se valida (`AAAA-MM-DD`) y se escapa; `imagen` solo acepta http(s) o rutas relativas.
- Los links se extraen antes del formateo: URLs con `__` o `*` ya no se rompen.
- Un HTTP 500 ya no se muestra como "Sin novedades" (cae al mensaje de error).
- `minecraft-server.html`: respaldo de JSZip en jsDelivr y mensaje claro si no carga.
- Google Analytics ahora se carga solo con consentimiento (`assets/consent.js`, banner Aceptar/Rechazar; reemplaza el bloque copiado en 9 páginas).
- `leiamc/assets/musica.mp3` recomprimido de 5 MB a 2,9 MB (112 kbps).

## Optimizacion
- cursor-glow detiene su `requestAnimationFrame` en idle y se reanuda con el mouse.
- `index.html` ya no carga `dog-runner.js/.css`.
- El `AudioContext` se crea en el primer gesto (solo se precarga el audio crudo).
- Click en un link del nav movil suena una sola vez.
- Las estrellas fugaces no se reactivan en modo rendimiento al volver a la pestana.
- El link activo del nav se limpia al volver al hero.

## SEO y docs
- `<title>` de `index.html` descriptivo; `<meta charset>` primero en `<head>` en todas las paginas.
- `sitemap.xml` sin `aero.html`; `llms.txt` y README actualizados (1 servidor Minecraft, CS Mixto activo, 1 sala Haxball); README sin mencion a `aero.html`.

## skin-editor
- Respaldo de three.js en jsDelivr y stub inerte si no hay three.js/WebGL: el editor 2D sigue funcionando (la vista 3D se oculta).

## No incluido
- `protondb-summary.json` (4,5 MB) ya esta minificado; el hosting lo comprime con gzip.
- Unificar el codigo copiado en 12 paginas (refactor grande, conviene hacerlo aparte).
