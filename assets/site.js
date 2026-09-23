(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktopNav = window.matchMedia("(min-width: 48rem)");
  document.documentElement.classList.add("js");

  var header = document.querySelector(".site-header");
  var button = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  var progress = document.querySelector(".scroll-progress span");
  var label = button && button.querySelector(".nav-toggle-label");

  function setOpen(open) {
    if (!button || !nav) return;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    if (label) label.textContent = open ? "Close menu" : "Open menu";
    if (open) {
      var first = nav.querySelector("a");
      if (first) first.focus();
    }
  }

  if (button && nav) {
    button.addEventListener("click", function () {
      setOpen(button.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) return;
      if (button.contains(event.target) || nav.contains(event.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        button.focus();
      }

      if (!nav.classList.contains("is-open") || event.key !== "Tab") return;
      var items = [button].concat(Array.prototype.slice.call(nav.querySelectorAll("a")));
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    desktopNav.addEventListener("change", function (event) {
      if (event.matches) setOpen(false);
    });
  }

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var amount = max > 0 ? window.scrollY / max : 0;
    if (progress) progress.style.transform = "scaleX(" + amount + ")";
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    spy();
  }

  var spyLinks = nav
    ? Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'))
    : [];
  var sections = spyLinks
    .map(function (link) {
      var id = link.getAttribute("href").slice(1);
      return document.getElementById(id);
    })
    .filter(Boolean);

  function spy() {
    if (!sections.length) return;
    var mark = Math.max((header ? header.getBoundingClientRect().bottom : 0) + 32, window.innerHeight * 0.34);
    var current = null;
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= mark) current = section.id;
    });
    spyLinks.forEach(function (link) {
      var on = current && link.getAttribute("href") === "#" + current;
      if (on) link.setAttribute("aria-current", "true");
      else if (link.getAttribute("aria-current") === "true") link.removeAttribute("aria-current");
    });
  }

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var reveals = document.querySelectorAll(".reveal");
  if (!reduce && "IntersectionObserver" in window) {
    reveals.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        el.classList.add("is-inview");
      }
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-inview");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );
    reveals.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-inview");
    });
  }

  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-service-tab]"));
  var aside = document.getElementById("service-detail");
  var asideTitle = document.getElementById("service-aside-title");
  var asidePoints = document.getElementById("service-aside-points");

  function paintAside(tab) {
    if (!aside || !asideTitle || !asidePoints) return;
    var row = tab.closest(".service-row");
    asideTitle.textContent = tab.querySelector(".service-name").textContent;
    aside.setAttribute("aria-labelledby", tab.id);
    asidePoints.textContent = "";
    row.querySelectorAll(".service-points li").forEach(function (item) {
      var next = document.createElement("li");
      next.textContent = item.textContent;
      asidePoints.appendChild(next);
    });
  }

  var tablist = document.querySelector("[data-service-list]");

  var fadeToken = 0;

  function selectTab(tab) {
    var roving = wideServices.matches;
    tabs.forEach(function (item) {
      var on = item === tab;
      if (roving) item.setAttribute("aria-selected", on ? "true" : "false");
      item.tabIndex = roving ? (on ? 0 : -1) : 0;
      item.closest(".service-row").classList.toggle("is-selected", on);
    });
    if (!aside) return;
    if (reduce || !wideServices.matches) {
      paintAside(tab);
      return;
    }
    var token = ++fadeToken;
    aside.classList.add("is-fading");
    window.setTimeout(function () {
      if (token !== fadeToken) return;
      paintAside(tab);
      aside.classList.remove("is-fading");
    }, 140);
  }

  var wideServices = window.matchMedia("(min-width: 64rem)");

  function syncServiceMode() {
    var on = wideServices.matches;
    if (aside) {
      aside.hidden = !on;
      if (on) aside.setAttribute("role", "tabpanel");
      else aside.removeAttribute("role");
    }
    if (tablist) {
      if (on) {
        tablist.setAttribute("role", "tablist");
        tablist.setAttribute("aria-orientation", "vertical");
      } else {
        tablist.removeAttribute("role");
        tablist.removeAttribute("aria-orientation");
      }
    }
    tabs.forEach(function (tab) {
      var selected = tab.closest(".service-row").classList.contains("is-selected");
      if (on) {
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", "service-detail");
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
      } else {
        tab.removeAttribute("role");
        tab.removeAttribute("aria-selected");
        tab.removeAttribute("aria-controls");
        tab.tabIndex = 0;
      }
    });
  }

  if (tabs.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        selectTab(tab);
      });
    });

    if (tablist) {
      tablist.addEventListener("keydown", function (event) {
        if (!wideServices.matches) return;
        var index = tabs.indexOf(document.activeElement);
        if (index < 0) return;
        var next = null;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          next = tabs[(index + 1) % tabs.length];
        } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          next = tabs[(index - 1 + tabs.length) % tabs.length];
        } else if (event.key === "Home") {
          next = tabs[0];
        } else if (event.key === "End") {
          next = tabs[tabs.length - 1];
        }
        if (!next) return;
        event.preventDefault();
        selectTab(next);
        next.focus();
      });
    }

    syncServiceMode();
    if (typeof wideServices.addEventListener === "function") {
      wideServices.addEventListener("change", syncServiceMode);
    } else if (typeof wideServices.addListener === "function") {
      wideServices.addListener(syncServiceMode);
    }
  }
})();
