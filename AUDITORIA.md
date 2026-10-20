# Auditoría LeiaNET — informe (18/10/2026)
Base: `origin/main` @ 323b76a (incluye tu último `futbol.html`, commit 9fd379d). Rama de trabajo local: `auditoria-seguridad-accesibilidad`. Nada fue subido ni desplegado.

## Corregido (verificación)
| # | Problema | Archivos | Verificación |
|---|---|---|---|
| 1 | XSS: datos de `steam-api` (nombres, géneros, URLs) en `innerHTML` sin escapar | canirun.html, steam-preview.html | Prueba con payloads (`xss-test`): neutralizados |
| 2 | `esc()` de encuestas no escapaba comillas (inseguro en atributos) | assets/encuestas.js | `node --check` |
| 3 | Scripts de three.js/JSZip desde CDN sin SRI | futbol.html, skin-editor.html, minecraft-server.html, assets/vendor/* | Sin referencias a CDN (`grep`); NO probado en navegador |
| 4 | Google Fonts sin consentimiento | agosto-2026/index.html | `grep` sin googleapis; sin prueba visual |
| 5 | Consentimiento: botones asimétricos, sin reabrir, revocar no apagaba GA | assets/consent.js | 13/13 pruebas jsdom |
| 6 | Faltaban política de privacidad y términos | privacidad.html, terminos.html + footers (10 págs) | axe: 0 violaciones |
| 7 | Modales sin gestión de foco | assets/a11y.js (index, canirun) | 3/3 pruebas jsdom |
| 8 | Toast sin `role=status`; botón copiar sin nombre; labels de admin; heading-order; alt redundantes; skip links; zoom bloqueado (`user-scalable=no`) | varios | axe sin violaciones salvo "region" en páginas de juego |
| 9 | CSP mínima (`object-src/base-uri/form-action`) | 15 páginas (excepto 404.html) | inspección |
| 10 | Créditos/licencias; `security.txt`; `.nojekyll` | assets/vendor/LICENSES.md, assets/fonts/LICENSES.md, .well-known/security.txt | inspección |

## Pendiente (requiere al propietario)
- **highcrest.ttf** ("Personal use only", © Letterara): RESUELTO. Eliminada y reemplazada por Cinzel (OFL) en `darkfantasy-mode.css`. Revisar visualmente el modo Dark Fantasy.
- Revisar procedencia: portadas de juegos (valorant, lol, fortnite, rocket-league, roblox, uncharted), skins/capas/armaduras de Mojang/4J, audios `gol/whi/near.*.mp3` (sin créditos). `amb.*.mp3`: C2PA indica generación con Claude a pedido del usuario.
- privacidad.html y terminos.html identifican al responsable solo como "LeiaNET" + soporte@leianet.ar (decisión del propietario de no publicar datos personales). Riesgo residual: la normativa de datos personales espera identificación del responsable; consultar con un abogado si el sitio crece. Puntos que quedaron sin detallar: retención de logs/votos, políticas de los servidores, jurisdicción.
- Cabeceras HTTP (CSP completa, HSTS, X-Frame-Options): GitHub Pages no permite; requiere Cloudflare u otro hosting.
- Backends no auditables desde el repo (novedades, steam-api, futbol WS, api.leianet.ar, encuestas): rate limiting, CORS, logs, hashing de IP, auth del admin.
- `futbol.html?server=`: un enlace armado puede conectar al jugador a un servidor ajeno.
- `admin.html` es público (con noindex); el token lo ingresa el usuario.
- Código propio sin licencia declarada.
- Asesor legal: transferencias a EE. UU. (art. 12 Ley 25.326), inscripción de bases (AAIP), aplicabilidad de normas de otros países.

## Limitaciones
Sin navegador real: no se midió contraste, foco visible, zoom ni reflujo; axe corrió sobre jsdom (sin JS de página). Quedan avisos "region" en las páginas-juego (canvas) y en un enlace de agosto-2026. No hay `package.json`, por lo que no hay `npm audit`; las librerías vendor son three r128, JSZip 3.10.1 y GSAP 3.15.0 (revisar CVEs manualmente).

## Cómo repetir
`git diff main...auditoria-seguridad-accesibilidad --stat` · `node --check assets/*.js` · `npm i jsdom axe-core && node axe-run.js <carpeta> *.html`
