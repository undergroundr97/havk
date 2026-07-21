const botaoHamburguer = document.getElementById("navbarBurger");
const menuMobile = document.getElementById("navbarMenu");

botaoHamburguer.addEventListener("click", () => {
  menuMobile.classList.toggle("navbar__menu--open");
});

menuMobile.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuMobile.classList.remove("navbar__menu--open");
  });
});
