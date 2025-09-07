// main.js - shared helpers + nav activation + accessibility small niceties
(function(){
  const path = location.pathname;
  const links = document.querySelectorAll('nav a[data-active]');
  links.forEach(a => {
    const target = a.getAttribute('href');
    if (target && path === target) a.classList.add('active');
  });

  // Reduce motion respects
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) document.documentElement.classList.add('reduced-motion');
})();
