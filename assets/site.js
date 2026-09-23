(function () {
  var button = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (!button || !nav) return;

  var label = button.querySelector(".nav-toggle-label");

  function setOpen(open) {
    button.setAttribute("aria-expanded", open ? "true" : "false");
    nav.classList.toggle("is-open", open);
    if (label) label.textContent = open ? "Close menu" : "Open menu";
  }

  button.addEventListener("click", function () {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });

  document.addEventListener("click", function (event) {
    if (!nav.classList.contains("is-open")) return;
    if (button.contains(event.target) || nav.contains(event.target)) return;
    setOpen(false);
  });

  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
  });
})();
