// hide_levels.js
// Скрытие всех объектов конкретного уровня во всех ветках структуры.
// [x] сверху скрывает уровень, "—" сверху возвращает уровень.
// Скрываются только сами объекты выбранного уровня, вложенные остаются видимыми.

(function () {
    if (typeof window === "undefined") return;
  
    const levelXMemory = new Map();
  
    function host() {
      return document.getElementById("tree");
    }
  
function isSchemaView() {
  return (
    typeof VIEW !== "undefined" &&
    typeof currentView !== "undefined" &&
    (
      currentView === VIEW.SCHEMA ||
      currentView === VIEW.STRUCTURE_TABLE
    )
  );
}
  
    function walk(node, fn) {
      if (!node) return;
  
      fn(node);
  
      for (const child of node.children || []) {
        walk(child, fn);
      }
    }
  
    function getDisplayRoot() {
      return window.objectFocus?.getFocusedRootNode?.() || root;
    }
  
    function collectNodesByLevel() {
      const map = new Map();
      const displayRoot = getDisplayRoot();
  
      walk(displayRoot, (node) => {
        if (!map.has(node.level)) {
          map.set(node.level, []);
        }
  
        map.get(node.level).push(node);
      });
  
      return map;
    }
  
    function getHiddenIdsSet() {
      const ids = window.hideNodes?.getAll?.() || [];
      return new Set(ids);
    }
  
    function isLevelHidden(level, nodesByLevel) {
      const nodes = nodesByLevel.get(level) || [];
      if (!nodes.length) return false;
  
      const hiddenIds = getHiddenIdsSet();
  
      return nodes.every((node) => hiddenIds.has(node.id));
    }
  
    function cssEscapeLocal(s) {
      const v = String(s);
      if (window.CSS && typeof CSS.escape === "function") return CSS.escape(v);
      return v.replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
    }
  
    function getNodeLevelById(id) {
      if (!id || typeof findWithParent !== "function") return null;
  
      const found = findWithParent(root, id);
      return found?.node?.level ?? null;
    }
  
    function getVisibleLevelPositions() {
      const h = host();
      const out = new Map();
  
      if (!h) return out;
  
      const hostBox = h.getBoundingClientRect();
  
      h.querySelectorAll(".row[data-id]").forEach((row) => {
        if (!row.getClientRects().length) return;
        if (row.closest(".structure-table")) return;
        if (row.closest(".hierarchy-view")) return;
        if (row.closest(".hierarchy-horizontal-view")) return;
        if (row.closest(".icicle-horizontal-view")) return;
        if (row.closest(".icicle-vertical-view")) return;
        if (row.closest(".leaf-page")) return;
  
        const id = row.dataset.id;
        const level = getNodeLevelById(id);
  
        if (level == null) return;
  
        const box = row.getBoundingClientRect();
        const x = Math.round(box.left - hostBox.left);
  
        if (!out.has(level)) {
          out.set(level, x);
        } else {
          out.set(level, Math.min(out.get(level), x));
        }
      });
  
      return out;
    }
  
    function rememberLevelX(level) {
      const positions = getVisibleLevelPositions();
  
      if (positions.has(level)) {
        levelXMemory.set(level, positions.get(level));
      }
    }
  
    function estimateStep(positions) {
      const pairs = Array.from(positions.entries())
        .filter(([, x]) => Number.isFinite(x))
        .sort((a, b) => a[0] - b[0]);
  
      const diffs = [];
  
      for (let i = 1; i < pairs.length; i++) {
        const levelDiff = pairs[i][0] - pairs[i - 1][0];
        const xDiff = pairs[i][1] - pairs[i - 1][1];
  
        if (levelDiff > 0 && xDiff > 0) {
          diffs.push(xDiff / levelDiff);
        }
      }
  
      if (!diffs.length) return 42;
  
      return Math.round(
        diffs.reduce((sum, d) => sum + d, 0) / diffs.length
      );
    }
  
    function getLevelX(level, knownPositions) {
      if (knownPositions.has(level)) {
        const x = knownPositions.get(level);
        levelXMemory.set(level, x);
        return x;
      }
  
      if (levelXMemory.has(level)) {
        return levelXMemory.get(level);
      }
  
      const step = estimateStep(knownPositions);
  
      const known = Array.from(knownPositions.entries())
        .filter(([, x]) => Number.isFinite(x))
        .sort((a, b) => a[0] - b[0]);
  
      if (!known.length) {
        return level * step;
      }
  
      let prev = null;
      let next = null;
  
      for (const item of known) {
        if (item[0] < level) prev = item;
        if (item[0] > level) {
          next = item;
          break;
        }
      }
  
      if (prev && next) {
        const ratio = (level - prev[0]) / (next[0] - prev[0]);
        return Math.round(prev[1] + (next[1] - prev[1]) * ratio);
      }
  
      if (prev) {
        return Math.round(prev[1] + step * (level - prev[0]));
      }
  
      if (next) {
        return Math.round(next[1] - step * (next[0] - level));
      }
  
      return level * step;
    }
  
function makeLevelButton(
  level,
  hidden
) {
  const btn =
    document.createElement(
      "button"
    );

  /*
    Нулевой уровень — это корневой
    объект структуры.

    Его скрывать нельзя, поэтому
    глазик должен быть неактивным.
  */

  const disabled =
    Number(level) === 0;

  btn.type = "button";

  btn.className =
    "level-hide-btn" +
    (
      hidden
        ? " is-hidden-level"
        : ""
    );

  btn.dataset.level =
    String(level);

  /*
    Подключаем общий компонент иконок.

    Видимый уровень:
      глазик hide.

    Скрытый уровень:
      горизонтальные стрелки
      restoreHorizontal.

    Нулевой уровень:
      серый неактивный глазик.
  */

  window.visibilityControls?.apply(
    btn,
    {
      kind: hidden
        ? "restoreHorizontal"
        : "hide",

      label: disabled
        ? "Нулевой уровень нельзя скрыть"
        : hidden
          ? `Показать объекты уровня ${level}`
          : `Скрыть объекты уровня ${level}`,

      disabled,

      /*
  Постоянно видна только кнопка возврата
  действительно скрытого уровня.

  Неактивный глазик нулевого уровня
  показывается вместе с остальными
  только при наведении на верхнюю панель.
*/

alwaysVisible:
  hidden,
    }
  );

  /*
    Кнопка не должна передавать нажатие
    дереву и менять активный объект.
  */

  btn.addEventListener(
    "pointerdown",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
    }
  );

  btn.addEventListener(
    "mousedown",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
    }
  );

  btn.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      /*
        Дополнительная защита:
        нулевой уровень не скрываем.
      */

      if (disabled) {
        return;
      }

      if (
        typeof isTreeLocked ===
          "function" &&
        isTreeLocked()
      ) {
        return;
      }

      toggleLevel(level);
    }
  );

  return btn;
}
  
  function hideLevel(
  level
) {

  if (
  Number(level) === 0
) {
  return false;
}
  /*
    Нулевой уровень скрывать нельзя.
  */

  if (
    Number(level) === 0
  ) {
    return false;
  }

  const nodesByLevel =
    collectNodesByLevel();

  const nodes =
    nodesByLevel.get(
      level
    ) || [];

  if (!nodes.length) {
    return false;
  }

  rememberLevelX(
    level
  );

  const ids =
    nodes.map(
      (node) =>
        node.id
    );

  if (
    window.hideNodes
      ?.hideMany
  ) {
    return window.hideNodes.hideMany(
      ids,
      true
    );
  }

  if (
    typeof pushHistory ===
    "function"
  ) {
    pushHistory();
  }

  ids.forEach(
    (id) => {
      window.hideNodes
        ?.hide?.(
          id,
          false
        );
    }
  );

  if (
    typeof render ===
    "function"
  ) {
    render();
  }

  return true;
}
  
    function showLevel(level) {
      const nodesByLevel = collectNodesByLevel();
      const nodes = nodesByLevel.get(level) || [];
  
      if (!nodes.length) return false;
  
      const ids = nodes.map((node) => node.id);
  
      if (window.hideNodes?.showMany) {
        return window.hideNodes.showMany(ids, true);
      }
  
      if (typeof pushHistory === "function") {
        pushHistory();
      }
  
      ids.forEach((id) => window.hideNodes?.show?.(id, false));
  
      if (typeof render === "function") render();
      return true;
    }
  
    function toggleLevel(level) {
      const nodesByLevel = collectNodesByLevel();
  
      if (isLevelHidden(level, nodesByLevel)) {
        showLevel(level);
      } else {
        hideLevel(level);
      }
    }
  
    function clearOldButtons() {
      const h = host();
      if (!h) return;
  
      h.querySelectorAll(".level-hide-btn").forEach((el) => el.remove());
      h.classList.remove("level-hide-active");
    }
  
    function layoutLevelButtons() {
  const h =
    host();

  if (!h) {
    return;
  }

  h
    .querySelectorAll(
      ".level-hide-bar"
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );

  h
    .querySelectorAll(
      ".level-hide-btn"
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );

  if (!isSchemaView()) {
    h.classList.remove(
      "level-hide-active"
    );

    return;
  }

  /*
    Карта объектов создаётся только один раз.
  */

  const nodesByLevel =
    collectNodesByLevel();

  /*
    Нулевой уровень теперь тоже включаем:
    его кнопка будет отображаться,
    но останется неактивной.
  */

  const levels =
    Array.from(
      nodesByLevel.keys()
    ).sort(
      (left, right) =>
        left - right
    );

  if (!levels.length) {
    h.classList.remove(
      "level-hide-active"
    );

    return;
  }

  h.classList.add(
    "level-hide-active"
  );

  const bar =
    document.createElement(
      "div"
    );

  bar.className =
    "level-hide-bar";

  for (const level of levels) {
    const nodes =
      nodesByLevel.get(
        level
      ) || [];

    if (!nodes.length) {
      continue;
    }

    const hidden =
      isLevelHidden(
        level,
        nodesByLevel
      );

    const btn =
      makeLevelButton(
        level,
        hidden
      );

    bar.appendChild(
      btn
    );
  }

  const controlsHost =
  (
    typeof VIEW !== "undefined" &&
    typeof currentView !== "undefined" &&
    currentView === VIEW.STRUCTURE_TABLE
  )
    ? (
        h.querySelector(
          ".structure-table-schema-pane"
        ) || h
      )
    : h;

controlsHost.prepend(
  bar
);
}
  
    function patchRender() {
      if (typeof window.render !== "function") return;
      if (window.render.__hideLevelsPatched) return;
  
      const originalRender = window.render;
  
      window.render = function patchedRenderHideLevels() {
        const result = originalRender.apply(this, arguments);
        layoutLevelButtons();
        return result;
      };
  
      window.render.__hideLevelsPatched = true;
    }
  
    function injectStyles() {
      if (document.getElementById("hideLevelsStyles")) return;
  
      const style = document.createElement("style");
      style.id = "hideLevelsStyles";
  
      style.textContent = `

  #tree .level-hide-btn {
    height: 14px;
    width: auto;
    padding: 0;
    margin: 0;
    border: 0;
    background: transparent;
    color: #6b7280;
    font: inherit;
    font-size: 12px !important;
    text-align: center;
    user-select: none;
    cursor: pointer;
  }

  #tree .level-hide-btn:hover {
    color: #000;
    background: transparent;
  }

  #tree .level-hide-btn.is-hidden-level {
    color: #6b7280;
    font: inherit;
    font-size: 12px !important;
    line-height: 20px;
    background: transparent;
  }

  #tree .level-hide-btn.is-hidden-level:hover {
    color: #000;
    background: transparent;
  }
`;
  
      document.head.appendChild(style);
    }
  
    window.hideLevels = {
  layout:
    layoutLevelButtons,

  hideLevel,
  showLevel,
  toggleLevel,

  isHidden(level) {
    return isLevelHidden(
      Number(level),
      collectNodesByLevel()
    );
  },
};
  
    injectStyles();
    patchRender();
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", layoutLevelButtons);
    } else {
      layoutLevelButtons();
    }
  
    window.addEventListener("resize", () => {
      try {
        layoutLevelButtons();
      } catch (_) {}
    });
  })();