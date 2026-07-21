const navbar = document.getElementById("navbar");

function updateNavbarOnScroll() {
  if (window.scrollY > 40) {
    navbar.classList.add("navbar--scrolled");
  } else {
    navbar.classList.remove("navbar--scrolled");
  }
}

window.addEventListener("scroll", updateNavbarOnScroll);
updateNavbarOnScroll();

const elementosParaRevelar = document.querySelectorAll(".reveal");

const observador = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        entrada.target.classList.add("reveal--visible");
        observador.unobserve(entrada.target);
      }
    });
  },
  {
    threshold: 0.15,
  }
);

elementosParaRevelar.forEach((elemento) => observador.observe(elemento));
