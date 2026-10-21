/* Chuleta de comandos Linux — JS puro, sin dependencias.
   Uso: <div id="cl-app"></div> + este script. Se inicia solo.

   No consulta ninguna API: los comandos están en este archivo. Buscador sin acentos ni
   mayúsculas, filtros por categoría y por gestor de paquetes, copia con un toque y
   marca de «cuidado» en los comandos que borran o reescriben cosas.
   Todo texto se inserta con textContent (nunca innerHTML). */
(function () {
  'use strict';

  const root = document.getElementById('cl-app');
  if (!root) return;
  root.classList.add('cl-app');

  /* ---------- 1. Datos ---------- */
  // Formato: [categoría, comando, descripción, nota opcional, ¿cuidado?]
  const CATS = [
    ['arch', 'Archivos y carpetas'],
    ['txt', 'Texto y búsqueda'],
    ['perm', 'Permisos y usuarios'],
    ['proc', 'Procesos y recursos'],
    ['red', 'Red y SSH'],
    ['disco', 'Discos y sistema'],
    ['pkg', 'Paquetes'],
    ['git', 'Git'],
    ['sys', 'systemd y logs'],
    ['dev', 'Docker y desarrollo'],
    ['shell', 'Shell y atajos'],
    ['gaming', 'Gaming en Linux'],
  ];
  const D = [
    // --- Archivos y carpetas
    ['arch', 'ls -lah', 'Lista con detalles, tamaños legibles y archivos ocultos.'],
    ['arch', 'cd -', 'Vuelve a la carpeta en la que estabas antes.'],
    ['arch', 'mkdir -p proyecto/src/utils', 'Crea carpetas anidadas; no falla si ya existen.'],
    ['arch', 'cp -r origen/ destino/', 'Copia una carpeta completa con su contenido.'],
    ['arch', 'mv viejo.txt nuevo.txt', 'Mueve o renombra un archivo o carpeta.'],
    ['arch', 'rm archivo.txt', 'Borra un archivo. No hay papelera: no se puede deshacer.', null, 1],
    ['arch', 'rm -rf carpeta/', 'Borra una carpeta y todo lo que tenga, sin preguntar.', 'Revisá la ruta dos veces. Nunca lo uses con / ni con variables que puedan estar vacías.', 1],
    ['arch', 'ln -s /ruta/real enlace', 'Crea un enlace simbólico (acceso directo) a un archivo o carpeta.'],
    ['arch', 'tree -L 2', 'Muestra el árbol de carpetas hasta 2 niveles.', 'Puede requerir instalar el paquete tree.'],
    ['arch', 'du -sh * | sort -h', 'Tamaño de cada elemento de la carpeta, de menor a mayor.'],
    ['arch', 'tar -czvf backup.tar.gz carpeta/', 'Comprime una carpeta en un .tar.gz.'],
    ['arch', 'tar -xf archivo.tar.xz', 'Descomprime un .tar (detecta solo gz, xz, bz2 o zst).'],
    ['arch', 'zip -r archivo.zip carpeta/', 'Crea un .zip con una carpeta.'],
    ['arch', 'unzip archivo.zip -d destino/', 'Descomprime un .zip en la carpeta indicada.'],
    ['arch', 'rsync -avh --progress origen/ destino/', 'Copia incremental: solo transfiere lo que cambió. Ideal para backups.', 'La barra final en origen/ importa: copia el contenido, no la carpeta en sí.'],
    ['arch', 'file archivo', 'Dice qué tipo de archivo es, sin fiarse de la extensión.'],
    ['arch', 'xdg-open .', 'Abre la carpeta actual en el explorador de archivos.'],

    // --- Texto y búsqueda
    ['txt', 'grep -rn "texto" .', 'Busca texto en todos los archivos, con número de línea.'],
    ['txt', 'grep -rniI "texto" --include="*.js" .', 'Búsqueda recursiva sin distinguir mayúsculas, ignorando binarios y solo en .js.'],
    ['txt', 'find . -name "*.log" -mtime -7', 'Archivos .log modificados en los últimos 7 días.'],
    ['txt', 'find . -type f -size +100M', 'Archivos de más de 100 MB: útil para liberar espacio.'],
    ['txt', 'less archivo.log', 'Lee un archivo largo página por página (q para salir, / para buscar).'],
    ['txt', 'tail -f archivo.log', 'Sigue un log en vivo a medida que se escribe.'],
    ['txt', 'head -n 20 archivo', 'Muestra las primeras 20 líneas.'],
    ['txt', 'wc -l archivo', 'Cuenta las líneas de un archivo.'],
    ['txt', 'sort archivo | uniq -c | sort -nr', 'Cuenta cuántas veces se repite cada línea, de mayor a menor.'],
    ['txt', "sed -i 's/viejo/nuevo/g' archivo", 'Reemplaza texto dentro del archivo, modificándolo.', 'Probá primero sin -i: imprime el resultado sin tocar el archivo.', 1],
    ['txt', "awk '{print $1}' archivo", 'Imprime solo la primera columna de cada línea.'],
    ['txt', 'cut -d: -f1 /etc/passwd', 'Extrae un campo separado por «:» (acá, los nombres de usuario).'],
    ['txt', 'diff -u a.txt b.txt', 'Muestra las diferencias entre dos archivos en formato unificado.'],
    ['txt', 'jq . archivo.json', 'Formatea y colorea un JSON.', 'Requiere instalar jq.'],
    ['txt', 'find . -name "*.tmp" -print0 | xargs -0 rm', 'Borra todos los .tmp encontrados, incluso con espacios en el nombre.', 'Primero ejecutá solo el find para ver qué va a borrar.', 1],

    // --- Permisos y usuarios
    ['perm', 'chmod +x script.sh', 'Le da permiso de ejecución a un script.'],
    ['perm', 'chmod 644 archivo', 'Lectura y escritura para vos; solo lectura para el resto.'],
    ['perm', 'chmod 755 carpeta', 'Todo para vos; leer y entrar para el resto. Típico de carpetas y programas.'],
    ['perm', 'sudo chown -R $USER:$USER carpeta/', 'Te devuelve la propiedad de una carpeta (por ejemplo, si quedó como root).'],
    ['perm', 'chmod -R 777 carpeta/', 'Da todos los permisos a todo el mundo.', 'Casi nunca es la solución: suele tapar un problema de propietario. Preferí chown o 755.', 1],
    ['perm', 'id', 'Muestra tu usuario y los grupos a los que pertenecés.'],
    ['perm', 'sudo usermod -aG docker $USER', 'Agrega tu usuario a un grupo (acá, docker).', 'Cerrá sesión y volvé a entrar para que se aplique. El -a es clave: sin él te saca de los otros grupos.'],
    ['perm', 'sudo !!', 'Repite el último comando, pero con sudo.'],

    // --- Procesos y recursos
    ['proc', 'htop', 'Monitor interactivo de procesos, CPU y memoria.', 'Requiere instalar htop; top viene por defecto.'],
    ['proc', 'ps aux | grep nombre', 'Busca un proceso por nombre y muestra su PID.'],
    ['proc', 'kill PID', 'Pide a un proceso que termine de forma ordenada.'],
    ['proc', 'kill -9 PID', 'Mata un proceso a la fuerza, sin dejarlo limpiar.', 'Usalo si kill normal no alcanza.', 1],
    ['proc', 'pkill -f nombre', 'Termina procesos cuyo comando contenga «nombre».'],
    ['proc', 'free -h', 'Memoria RAM y swap, en unidades legibles.'],
    ['proc', 'lsof -i :3000', 'Qué proceso está usando el puerto 3000.'],
    ['proc', 'watch -n 1 comando', 'Ejecuta un comando cada segundo y muestra el resultado actualizado.'],
    ['proc', 'nohup comando &', 'Corre un comando en segundo plano y lo mantiene vivo aunque cierres la terminal.'],
    ['proc', 'time comando', 'Mide cuánto tarda en ejecutarse un comando.'],
    ['proc', 'nproc', 'Cantidad de núcleos lógicos de tu CPU.'],

    // --- Red y SSH
    ['red', 'ip -br a', 'Interfaces de red y sus IPs, en una línea cada una.'],
    ['red', 'ping -c 4 1.1.1.1', 'Prueba si hay conexión (4 intentos).'],
    ['red', 'ss -tulpn', 'Puertos en escucha y qué programa los abrió.', 'Con sudo se ven los nombres de los procesos de otros usuarios.'],
    ['red', 'curl -I https://ejemplo.com', 'Trae solo las cabeceras HTTP de una URL.'],
    ['red', 'curl -fsSL https://ejemplo.com/archivo -o archivo', 'Descarga un archivo, falla con errores HTTP y sigue redirecciones.'],
    ['red', 'wget -c https://ejemplo.com/archivo.iso', 'Descarga y continúa desde donde quedó si se cortó.'],
    ['red', 'dig +short ejemplo.com', 'Resuelve un dominio a su IP.', 'dig viene en bind-utils o dnsutils según la distro.'],
    ['red', 'mtr ejemplo.com', 'Traceroute y ping combinados en vivo: sirve para ubicar dónde se pierde la conexión.', 'Requiere instalar mtr.'],
    ['red', 'nmcli device wifi list', 'Lista las redes Wi-Fi cercanas (NetworkManager).'],
    ['red', 'ssh usuario@host', 'Conecta a otra máquina por SSH.'],
    ['red', 'ssh-keygen -t ed25519 -C "tu@mail.com"', 'Genera una clave SSH moderna.'],
    ['red', 'ssh-copy-id usuario@host', 'Copia tu clave pública al servidor para entrar sin contraseña.'],
    ['red', 'scp archivo usuario@host:/ruta/', 'Copia un archivo a otra máquina por SSH.'],
    ['red', 'ssh -L 8080:localhost:80 usuario@host', 'Túnel: tu puerto 8080 apunta al puerto 80 del servidor.'],
    ['red', 'python3 -m http.server 8000', 'Levanta un servidor web con la carpeta actual en http://localhost:8000.', 'Escucha en todas las interfaces; agregá --bind 127.0.0.1 para que sea solo local.'],

    // --- Discos y sistema
    ['disco', 'df -h', 'Espacio libre y usado en cada partición.'],
    ['disco', 'lsblk -f', 'Discos, particiones, sistemas de archivos y puntos de montaje.'],
    ['disco', 'ncdu', 'Explorador interactivo del uso de disco: ideal para encontrar qué ocupa tanto.', 'Requiere instalar ncdu.'],
    ['disco', 'cat /etc/os-release', 'Distribución y versión instalada.'],
    ['disco', 'uname -r', 'Versión del kernel en uso.'],
    ['disco', 'lscpu', 'Información detallada del procesador.'],
    ['disco', 'lspci | grep -iE "vga|3d"', 'Muestra qué placas de video tenés.'],
    ['disco', 'lsusb', 'Lista los dispositivos USB conectados.'],
    ['disco', 'sensors', 'Temperaturas y ventiladores.', 'Requiere lm-sensors; corré sudo sensors-detect una vez.'],
    ['disco', 'sudo dmesg --level=err,warn | tail -30', 'Últimos errores y avisos del kernel: drivers, discos, hardware.'],
    ['disco', 'sudo dd if=archivo.iso of=/dev/sdX bs=4M status=progress conv=fsync', 'Graba una ISO en un pendrive.', 'Si te equivocás de /dev/sdX borrás ese disco entero. Confirmá con lsblk antes.', 1],
    ['disco', 'sudo mount /dev/sdb1 /mnt', 'Monta una partición en /mnt.'],
    ['disco', 'sudo umount /mnt', 'Desmonta de forma segura antes de sacar un disco.'],
    ['disco', 'timedatectl', 'Hora, zona horaria y estado de la sincronización.'],

    // --- Paquetes
    ['pkg', 'sudo apt update && sudo apt upgrade', 'Actualiza la lista de paquetes y los instala. (Debian, Ubuntu, Mint)', null, 0, 'apt'],
    ['pkg', 'sudo apt install paquete', 'Instala un paquete. (Debian, Ubuntu, Mint)', null, 0, 'apt'],
    ['pkg', 'apt search palabra', 'Busca paquetes por nombre o descripción. (Debian, Ubuntu, Mint)', null, 0, 'apt'],
    ['pkg', 'sudo apt autoremove', 'Quita paquetes que ya no se necesitan. (Debian, Ubuntu, Mint)', null, 0, 'apt'],
    ['pkg', 'sudo dnf upgrade --refresh', 'Actualiza todo el sistema. (Fedora)', null, 0, 'dnf'],
    ['pkg', 'sudo dnf install paquete', 'Instala un paquete. (Fedora)', null, 0, 'dnf'],
    ['pkg', 'sudo pacman -Syu', 'Sincroniza y actualiza todo el sistema. (Arch, Manjaro, CachyOS)', 'En Arch no instales paquetes sin actualizar antes (evitá -Sy suelto).', 0, 'pacman'],
    ['pkg', 'sudo pacman -S paquete', 'Instala un paquete. (Arch)', null, 0, 'pacman'],
    ['pkg', 'pacman -Ss palabra', 'Busca paquetes en los repositorios. (Arch)', null, 0, 'pacman'],
    ['pkg', 'sudo pacman -Rns paquete', 'Desinstala un paquete con sus dependencias y configuración. (Arch)', null, 0, 'pacman'],
    ['pkg', 'flatpak install flathub com.valvesoftware.Steam', 'Instala Steam desde Flathub (sirve en cualquier distro con Flatpak).', null, 0, 'flatpak'],
    ['pkg', 'flatpak update', 'Actualiza todas las apps Flatpak.', null, 0, 'flatpak'],
    ['pkg', 'flatpak override --user --filesystem=/mnt/juegos com.valvesoftware.Steam', 'Le da a Steam (Flatpak) acceso a otro disco o carpeta donde guardás juegos.', 'Cambiá /mnt/juegos por tu ruta.', 0, 'flatpak'],
    ['pkg', 'which comando', 'Muestra dónde está instalado un programa.'],

    // --- Git
    ['git', 'git status -sb', 'Estado resumido: rama y archivos modificados.'],
    ['git', 'git add -p', 'Elegí trozo por trozo qué cambios incluir en el commit.'],
    ['git', 'git commit -m "mensaje"', 'Crea un commit con lo que está en staging.'],
    ['git', 'git commit --amend', 'Modifica el último commit (mensaje o contenido).', 'No lo uses si ya hiciste push de ese commit.'],
    ['git', 'git log --oneline --graph --decorate -20', 'Historial compacto en forma de grafo.'],
    ['git', 'git diff --staged', 'Cambios que van a entrar en el próximo commit.'],
    ['git', 'git switch -c nueva-rama', 'Crea una rama y se pasa a ella.'],
    ['git', 'git switch rama', 'Cambia a otra rama.'],
    ['git', 'git pull --rebase', 'Trae cambios del remoto y reubica tus commits encima.'],
    ['git', 'git push -u origin rama', 'Sube la rama y la deja enlazada con el remoto.'],
    ['git', 'git stash push -u -m "wip"', 'Guarda cambios (incluyendo archivos nuevos) para retomarlos después.'],
    ['git', 'git stash pop', 'Recupera lo último que guardaste con stash.'],
    ['git', 'git restore archivo', 'Descarta los cambios sin commitear de un archivo.', 'No se puede deshacer.', 1],
    ['git', 'git restore --staged archivo', 'Saca un archivo de staging sin perder los cambios.'],
    ['git', 'git reset --soft HEAD~1', 'Deshace el último commit pero deja los cambios listos para commitear.'],
    ['git', 'git reset --hard HEAD~1', 'Deshace el último commit y descarta todos los cambios.', 'Perdés el trabajo sin commitear. Si te arrepentís, git reflog puede ayudar.', 1],
    ['git', 'git reflog', 'Historial de a dónde apuntó HEAD: salva commits «perdidos».'],
    ['git', 'git revert hash', 'Crea un commit que deshace otro, sin reescribir la historia.'],
    ['git', 'git cherry-pick hash', 'Copia un commit de otra rama a la actual.'],
    ['git', 'git clean -fd', 'Borra archivos y carpetas sin seguimiento.', 'Probá antes con -n para ver qué borraría.', 1],
    ['git', 'git push --force-with-lease', 'Fuerza el push, pero falla si alguien más subió algo en el medio.', 'Mejor que --force. Igual reescribe historia del remoto.', 1],
    ['git', 'git clone --depth 1 https://github.com/usuario/repo', 'Clona solo el último estado: mucho más rápido en repos grandes.'],
    ['git', 'git format-patch -1 HEAD', 'Exporta el último commit como archivo .patch (parche).'],
    ['git', 'git apply --check archivo.patch', 'Verifica si un .patch se puede aplicar sin tocar nada.'],
    ['git', 'git am archivo.patch', 'Aplica un parche (.patch) generado con format-patch, conservando autor y mensaje.'],

    // --- systemd y logs
    ['sys', 'systemctl status servicio', 'Estado de un servicio y sus últimas líneas de log.'],
    ['sys', 'sudo systemctl restart servicio', 'Reinicia un servicio.'],
    ['sys', 'sudo systemctl enable --now servicio', 'Lo inicia ahora y lo deja activado en cada arranque.'],
    ['sys', 'systemctl --failed', 'Lista los servicios que fallaron.'],
    ['sys', 'journalctl -u servicio -f', 'Sigue en vivo los logs de un servicio.'],
    ['sys', 'journalctl -b -p err', 'Errores del arranque actual.'],
    ['sys', 'journalctl --since "1 hour ago"', 'Logs de la última hora.'],
    ['sys', 'sudo journalctl --vacuum-size=500M', 'Reduce los logs del journal a 500 MB para liberar espacio.'],
    ['sys', 'systemd-analyze blame', 'Qué servicios tardan más en el arranque.'],
    ['sys', 'crontab -e', 'Edita tus tareas programadas.', 'Formato: min hora día mes día-semana comando.'],

    // --- Docker y desarrollo
    ['dev', 'docker ps -a', 'Lista todos los contenedores, incluso los detenidos.'],
    ['dev', 'docker run --rm -it ubuntu bash', 'Abre una terminal en un Ubuntu descartable.'],
    ['dev', 'docker exec -it contenedor bash', 'Entra a un contenedor que ya está corriendo.'],
    ['dev', 'docker compose up -d', 'Levanta los servicios del compose en segundo plano.'],
    ['dev', 'docker compose logs -f', 'Sigue los logs de todos los servicios.'],
    ['dev', 'docker compose down', 'Detiene y elimina los contenedores del compose.'],
    ['dev', 'docker system prune', 'Borra contenedores detenidos, redes sin uso e imágenes colgantes.', 'Con -a borra también todas las imágenes sin usar.', 1],
    ['dev', 'python3 -m venv .venv && source .venv/bin/activate', 'Crea y activa un entorno virtual de Python.'],
    ['dev', 'pip install -r requirements.txt', 'Instala las dependencias de un proyecto Python.'],
    ['dev', 'npm ci', 'Instala dependencias exactas del package-lock (ideal en CI y builds limpios).'],
    ['dev', 'make -j$(nproc)', 'Compila usando todos los núcleos.'],

    // --- Shell y atajos
    ['shell', 'Ctrl + R', 'Busca en el historial de comandos mientras escribís.', 'Es un atajo de teclado, no un comando.'],
    ['shell', 'history | grep ssh', 'Busca comandos anteriores que contengan «ssh».'],
    ['shell', '!!', 'Repite el último comando.'],
    ['shell', 'alias ll="ls -lah"', 'Crea un alias para esta sesión.', 'Para dejarlo fijo, agregalo a ~/.bashrc o ~/.zshrc.'],
    ['shell', 'export VARIABLE=valor', 'Define una variable de entorno para esta sesión.'],
    ['shell', 'echo $PATH | tr ":" "\\n"', 'Muestra las carpetas del PATH, una por línea.'],
    ['shell', 'comando --help', 'Muestra la ayuda rápida de casi cualquier comando.'],
    ['shell', 'man comando', 'Abre el manual completo (q para salir).'],
    ['shell', 'echo $XDG_SESSION_TYPE', 'Te dice si estás en una sesión x11 o wayland.'],

    // --- Gaming en Linux
    ['gaming', 'glxinfo -B', 'Resumen de tu GPU y el driver OpenGL en uso.', 'Viene en mesa-utils.'],
    ['gaming', 'vulkaninfo --summary', 'Muestra las GPUs y drivers Vulkan disponibles.', 'Viene en vulkan-tools. Si falla, falta el driver Vulkan.'],
    ['gaming', 'nvidia-smi', 'Estado de tu GPU Nvidia: uso, memoria, temperatura y procesos.'],
    ['gaming', 'watch -n 1 nvidia-smi', 'Lo mismo, actualizado cada segundo mientras jugás.'],
    ['gaming', 'lspci -k | grep -A3 -iE "vga|3d"', 'Qué driver (kernel module) está usando cada placa de video.'],
    ['gaming', 'gamemoded -s', 'Verifica si GameMode está activo.'],
    ['gaming', 'gamemoded -t', 'Test de GameMode: confirma que está bien instalado.'],
    ['gaming', 'mangohud glxgears', 'Prueba rápida de MangoHud con una demo de OpenGL.'],
    ['gaming', 'sudo cpupower frequency-set -g performance', 'Pone el governor de la CPU en «performance».', 'Se pierde al reiniciar. Requiere cpupower.'],
    ['gaming', 'cat /proc/sys/vm/max_map_count', 'Ver el límite de memory maps: algunos juegos exigentes se cierran si es bajo.'],
    ['gaming', 'sudo sysctl -w vm.max_map_count=1048576', 'Sube el límite de memory maps hasta el próximo reinicio.', 'Para fijarlo, ponelo en un archivo dentro de /etc/sysctl.d/.'],
    ['gaming', 'protontricks --gui', 'Abre protontricks para instalar librerías (vcrun, dotnet…) en el prefijo de un juego.', 'Requiere instalar protontricks.'],
    ['gaming', 'protontricks -s nombre', 'Busca el AppID de un juego por su nombre.'],
    ['gaming', 'mkdir -p ~/.steam/root/compatibilitytools.d', 'Crea la carpeta donde Steam busca versiones de Proton instaladas a mano (ej. GE-Proton).', 'Después extraés el .tar.gz ahí adentro con tar -xf y reiniciás Steam. ProtonUp-Qt lo hace con interfaz gráfica.'],
    ['gaming', 'ls ~/.steam/steam/steamapps/compatdata/', 'Lista los prefijos de Wine/Proton de cada juego (la carpeta es el AppID).'],
    ['gaming', 'rm -rf ~/.steam/steam/steamapps/compatdata/APPID', 'Borra el prefijo de un juego para que Proton lo recree desde cero.', 'Puede llevarse partidas guardadas y configuraciones locales que estén ahí. Hacé backup antes.', 1],
  ];

  const COMANDOS = D.map((r, i) => ({
    i, cat: r[0], cmd: r[1], desc: r[2], nota: r[3] || '', peligro: !!r[4], distro: r[5] || '',
    hay: norm([r[1], r[2], r[3] || '', (CATS.find(c => c[0] === r[0]) || [, ''])[1], r[5] || ''].join(' ')),
  }));
  const CAT_NOMBRE = Object.fromEntries(CATS);
  const DISTROS = [['apt', 'apt'], ['dnf', 'dnf'], ['pacman', 'pacman'], ['flatpak', 'Flatpak']];

  // Sin acentos ni mayúsculas, para que «ejecucion» encuentre «ejecución».
  function norm(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  /* ---------- 2. Estado ---------- */
  const st = { q: '', cat: 'todo', distro: '', seguro: false };
  const hashCat = decodeURIComponent((location.hash || '').slice(1));
  if (CAT_NOMBRE[hashCat]) st.cat = hashCat;

  /* ---------- 3. DOM ---------- */
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  }
  let toastT = 0;
  const toast = el('div', { class: 'cl-toast', role: 'status', 'aria-live': 'polite' });
  function avisar(msg) {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 1600);
  }
  async function copiar(texto, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(texto); ok = true; } catch (e) {
      const ta = el('textarea', { 'aria-hidden': 'true', tabindex: '-1' });
      ta.value = texto; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(ta); ta.focus({ preventScroll: true }); ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
    }
    if (btn) {
      if (!btn.dataset.txt) btn.dataset.txt = btn.textContent;
      btn.textContent = ok ? 'Copiado ✓' : 'No se pudo';
      btn.classList.toggle('is-ok', ok);
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.textContent = btn.dataset.txt; btn.classList.remove('is-ok'); }, 1400);
    }
    avisar(ok ? 'Copiado al portapapeles' : 'No se pudo copiar: seleccioná el texto a mano');
  }

  // Devuelve el texto con las coincidencias envueltas en <mark>, armado con nodos (sin innerHTML).
  function resaltar(texto, palabras) {
    if (!palabras.length) return [texto];
    const n = norm(texto), marcas = [];
    for (const p of palabras) {
      let pos = 0, k;
      while ((k = n.indexOf(p, pos)) !== -1) { marcas.push([k, k + p.length]); pos = k + p.length; }
    }
    if (!marcas.length) return [texto];
    marcas.sort((a, b) => a[0] - b[0]);
    const uni = [marcas[0].slice()];
    for (const m of marcas.slice(1)) { const u = uni[uni.length - 1]; if (m[0] <= u[1]) u[1] = Math.max(u[1], m[1]); else uni.push(m.slice()); }
    const out = []; let cur = 0;
    for (const [a, b] of uni) {
      if (a > cur) out.push(texto.slice(cur, a));
      out.push(el('mark', { class: 'cl-hit', text: texto.slice(a, b) }));
      cur = b;
    }
    if (cur < texto.length) out.push(texto.slice(cur));
    return out;
  }

  /* ---------- 4. Interfaz ---------- */
  const refs = {};

  function chip(texto, pressed, onClick, extra) {
    const b = el('button', { type: 'button', class: 'cl-chip', 'aria-pressed': String(!!pressed) }, texto);
    if (extra != null) b.append(el('small', { text: String(extra) }));
    b.addEventListener('click', onClick);
    return b;
  }

  function pintarFiltros() {
    const cuenta = {}; let total = 0;
    for (const c of COMANDOS) if (!(st.seguro && c.peligro)) { cuenta[c.cat] = (cuenta[c.cat] || 0) + 1; total++; }
    refs.cats.replaceChildren(chip('Todo', st.cat === 'todo', () => { st.cat = 'todo'; st.distro = ''; actualizar(); }, total));
    for (const [id, nombre] of CATS) refs.cats.append(chip(nombre, st.cat === id, () => { st.cat = id; if (id !== 'pkg') st.distro = ''; actualizar(); }, cuenta[id] || 0));

    refs.distros.hidden = st.cat !== 'pkg';
    refs.distros.replaceChildren(el('span', { class: 'cl-label', text: 'Gestor' }),
      chip('Todos', !st.distro, () => { st.distro = ''; actualizar(); }));
    for (const [id, nombre] of DISTROS) refs.distros.append(chip(nombre, st.distro === id, () => { st.distro = st.distro === id ? '' : id; actualizar(); }));

    refs.seguro.setAttribute('aria-pressed', String(st.seguro));
  }

  function tarjeta(c, palabras) {
    const copy = el('button', { type: 'button', class: 'cl-copy', text: 'Copiar', 'aria-label': 'Copiar comando: ' + c.cmd });
    const code = el('code', { title: 'Tocá para copiar' }, ...resaltar(c.cmd, palabras));
    const caja = el('div', { class: 'cl-code' }, code, copy);
    const hacer = () => copiar(c.cmd, copy);
    copy.addEventListener('click', hacer);
    code.addEventListener('click', hacer);

    const top = el('div', { class: 'cl-item__top' }, el('span', { class: 'cl-tag', text: CAT_NOMBRE[c.cat] }));
    if (c.distro) top.append(el('span', { class: 'cl-tag', text: c.distro }));
    if (c.peligro) top.append(el('span', { class: 'cl-tag cl-tag--danger', text: '⚠ Cuidado' }));

    const art = el('article', { class: 'cl-item cl-panel' + (c.peligro ? ' cl-item--danger' : '') }, top,
      el('p', { class: 'cl-item__desc' }, ...resaltar(c.desc, palabras)));
    if (c.nota) art.append(el('p', { class: 'cl-item__nota' }, ...resaltar(c.nota, palabras)));
    art.append(caja);
    return art;
  }

  function pintarLista() {
    const palabras = norm(st.q).split(/\s+/).filter(Boolean);
    const lista = COMANDOS.filter(c =>
      (st.cat === 'todo' || c.cat === st.cat) &&
      (!st.distro || c.distro === st.distro) &&
      !(st.seguro && c.peligro) &&
      palabras.every(p => c.hay.includes(p)));

    refs.grid.replaceChildren(...lista.map(c => tarjeta(c, palabras)));
    refs.vacio.hidden = lista.length > 0;
    refs.pill.replaceChildren(el('strong', { text: String(lista.length) }), lista.length === 1 ? ' comando' : ' comandos');
  }

  function actualizar() {
    pintarFiltros();
    pintarLista();
    try { history.replaceState(null, '', st.cat === 'todo' ? location.pathname + location.search : '#' + st.cat); } catch (e) { /* ignorar */ }
  }

  function construir() {
    refs.pill = el('p', { class: 'cl-pill' });
    const head = el('div', { class: 'cl-head' },
      el('div', {}, el('h2', { class: 'cl-head__title', text: 'Chuleta de comandos' }),
        el('p', { class: 'cl-head__sub', text: 'Lo que siempre te olvidás, con explicación en castellano. Tocá un comando para copiarlo.' })),
      refs.pill);

    const input = el('input', { type: 'search', class: 'cl-input', id: 'cl-q', placeholder: 'Buscá: permisos, puerto, git, proton, comprimir…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Buscar comandos', maxlength: 80 });
    let t = 0;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = input.value; pintarLista(); }, 70); });
    refs.input = input;

    refs.seguro = el('button', { type: 'button', class: 'cl-chip', 'aria-pressed': 'false', text: 'Ocultar comandos con ⚠' });
    refs.seguro.addEventListener('click', () => { st.seguro = !st.seguro; actualizar(); });

    const barra = el('div', { class: 'cl-toolbar' },
      el('div', { class: 'cl-field cl-field--grow cl-search' },
        el('label', { class: 'cl-label', for: 'cl-q', text: 'Buscar' }), input, el('span', { class: 'cl-kbd', 'aria-hidden': 'true', text: '/' })),
      el('div', { class: 'cl-field' }, el('span', { class: 'cl-label', text: 'Filtro' }), refs.seguro));

    refs.cats = el('div', { class: 'cl-chips cl-cats', role: 'group', 'aria-label': 'Categorías' });
    refs.distros = el('div', { class: 'cl-chips', role: 'group', 'aria-label': 'Gestor de paquetes', style: 'margin-top:10px;align-items:center' });
    refs.grid = el('div', { class: 'cl-grid' });
    refs.vacio = el('div', { class: 'cl-estado', hidden: true }, 'No encontramos nada con esa búsqueda. Probá con otra palabra o ',
      (() => { const b = el('button', { type: 'button', class: 'cl-btn', style: 'margin-left:6px', text: 'Limpiar filtros' });
        b.addEventListener('click', () => { st.q = ''; st.cat = 'todo'; st.distro = ''; st.seguro = false; input.value = ''; actualizar(); }); return b; })());

    root.append(head, barra, refs.cats, refs.distros, refs.grid, refs.vacio, toast);

    // «/» enfoca el buscador (como en GitHub), salvo que ya estés escribiendo en otro campo.
    document.addEventListener('keydown', e => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const a = document.activeElement, tag = a && a.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a && a.isContentEditable)) return;
      e.preventDefault(); input.focus(); input.select();
    });
  }

  construir();
  actualizar();
})();
