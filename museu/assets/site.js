/* MUVVI — escala do desenho pela largura da janela + animações de entrada ao rolar. Sem dependências. */
(function () {
  var raiz = document.documentElement;
  function escala() {
    var vw = raiz.clientWidth;
    raiz.style.setProperty('--kd', Math.min(vw / 1200, 1.5));
    raiz.style.setProperty('--km', Math.min(vw / 390, 2));
  }
  escala();
  var t;
  addEventListener('resize', function () { clearTimeout(t); t = setTimeout(escala, 60); });

  var itens = [].slice.call(document.querySelectorAll('.an-pre'));
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion:reduce)').matches) {
    itens.forEach(function (n) { n.classList.remove('an-pre'); });
    return;
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('an-go');
      e.target.classList.remove('an-pre');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  itens.forEach(function (n) { io.observe(n); });
})();
