/* Isolated Command — ⌘K command palette ("Ask Isolated Command").
 * Zero dependencies. Markup is server-rendered by partials/palette.html;
 * this file only wires behaviour: open (⌘K / Ctrl+K / trigger click),
 * filter as you type, arrow-key navigation, Enter to go, Esc to close.
 */
(function () {
  "use strict";

  var root = document.getElementById("ic-palette");
  if (!root) return;

  var input = root.querySelector("input");
  var list = root.querySelector(".ic-palette-list");
  var items = Array.prototype.slice.call(list.querySelectorAll("a"));
  var empty = list.querySelector(".ic-palette-empty");
  var triggers = document.querySelectorAll("[data-ic-palette-open]");
  var activeIndex = -1;

  function visibleItems() {
    return items.filter(function (a) { return !a.hidden; });
  }

  function setActive(index) {
    var vis = visibleItems();
    items.forEach(function (a) { a.classList.remove("active"); });
    if (!vis.length) { activeIndex = -1; return; }
    activeIndex = (index + vis.length) % vis.length;
    vis[activeIndex].classList.add("active");
    vis[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function filter() {
    var q = input.value.trim().toLowerCase();
    var any = false;
    items.forEach(function (a) {
      var hit = !q || a.textContent.toLowerCase().indexOf(q) !== -1;
      a.hidden = !hit;
      if (hit) any = true;
    });
    if (empty) empty.hidden = any;
    setActive(0);
  }

  function open() {
    root.hidden = false;
    input.value = "";
    filter();
    input.focus();
    document.documentElement.style.overflow = "hidden";
  }

  function close() {
    root.hidden = true;
    document.documentElement.style.overflow = "";
  }

  triggers.forEach(function (t) {
    t.addEventListener("click", function (e) { e.preventDefault(); open(); });
  });

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "k") {
      e.preventDefault();
      root.hidden ? open() : close();
      return;
    }
    if (root.hidden) return;
    if (e.key === "Escape") { close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeIndex + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIndex - 1); }
    else if (e.key === "Enter") {
      var vis = visibleItems();
      if (activeIndex >= 0 && vis[activeIndex]) vis[activeIndex].click();
    }
  });

  input.addEventListener("input", filter);

  root.addEventListener("click", function (e) {
    if (e.target === root) close();
  });
})();
