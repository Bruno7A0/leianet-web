/* Gestión de foco para diálogos (WCAG 2.4.3 / 2.1.2): al abrirse un modal mueve el foco adentro,
   atrapa Tab/Shift+Tab y, al cerrarse, la lógica de cada página ya devuelve el foco al disparador. */
(function(){
  var SEL='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var active=null;
  function focusables(d){return Array.prototype.filter.call(d.querySelectorAll(SEL),function(e){return !e.hidden&&e.offsetParent!==null||e===document.activeElement;});}
  function open(modal){
    var d=modal.querySelector('.nv-dialog,.cir-modal-box')||modal; active=d;
    if(!d.hasAttribute('tabindex')) d.setAttribute('tabindex','-1');
    var f=focusables(d); var target=d.querySelector('.nv-close,.cir-modal-x')||f[0]||d;
    try{target.focus({preventScroll:true});}catch(e){}
  }
  document.addEventListener('keydown',function(e){
    if(e.key!=='Tab'||!active||!document.body.contains(active)) return;
    var host=active.closest('.nv-modal,.cir-modal'); if(host&&host.classList.contains('nv-modal')&&!host.classList.contains('open')){active=null;return;}
    var f=focusables(active); if(!f.length){e.preventDefault();return;}
    var first=f[0],last=f[f.length-1],cur=document.activeElement;
    if(!active.contains(cur)){e.preventDefault();first.focus();}
    else if(e.shiftKey&&cur===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&cur===last){e.preventDefault();first.focus();}
  });
  new MutationObserver(function(ms){
    ms.forEach(function(m){
      if(m.type==='attributes'&&m.target.classList&&m.target.classList.contains('nv-modal')){
        var was=(m.oldValue||'').split(/\s+/).indexOf('open')!==-1, is=m.target.classList.contains('open');
        if(is&&!was) open(m.target); if(!is&&was) active=null;
      }
      Array.prototype.forEach.call(m.addedNodes||[],function(n){ if(n.nodeType===1&&n.classList.contains('cir-modal')) open(n); });
      Array.prototype.forEach.call(m.removedNodes||[],function(n){ if(n.nodeType===1&&n.classList.contains('cir-modal')) active=null; });
    });
  }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
})();
