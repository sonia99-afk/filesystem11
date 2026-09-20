// structure_table/structure_table_row_sync.js
// Быстрая синхронизация строк структуры и таблицы.

(function () {
  if (typeof window === "undefined") return;

  let resizeObserver = null;
  let mutationObserver = null;
  let mountedRoot = null;
  let mountedContext = null;
  let frame = 0;
  let selectionFrame = 0;
  let syncing = false;
  let lineLayoutPending = false;
  let observedSizes = new WeakMap();

  const SIZE_EPSILON = 0.25;

  function getElements(root) {
    return {
      structureHeader:
        root?.querySelector(
          ".structure-table-schema-header"
        ) || null,

      structureBody:
        root?.querySelector(
          ".structure-table-schema-body"
        ) || null,

      table:
        root?.querySelector(
          ".structure-table-table-pane .structure-table"
        ) || null,
    };
  }

  function cssEscapeLocal(value) {
    const text = String(value || "");

    if (window.CSS?.escape) {
      return window.CSS.escape(text);
    }

    return text.replace(
      /[^a-zA-Z0-9_-]/g,
      "\\$&"
    );
  }

  /*
    Совместимость resize/reorder
    со старой sticky-версией.
  */
  function getCoveredRight(element) {
    const combinedView =
      element?.closest?.(
        ".structure-table-combined-view"
      );

    if (
      combinedView?.classList.contains(
        "structure-table-integrated-columns"
      )
    ) {
      return null;
    }

    const structurePane =
      combinedView?.querySelector(
        ":scope > .structure-table-schema-pane"
      );

    return structurePane
      ? structurePane
          .getBoundingClientRect()
          .right
      : null;
  }

  function isHeaderCovered(header) {
    const coveredRight =
      getCoveredRight(header);

    if (coveredRight === null) {
      return false;
    }

    return (
      header
        .getBoundingClientRect()
        .left <
      coveredRight - 0.5
    );
  }

  function canUseDropSlot(
    headers,
    slot,
    clientX
  ) {
    const coveredRight =
      getCoveredRight(
        headers?.[0]
      );

    if (coveredRight === null) {
      return true;
    }

    if (clientX <= coveredRight) {
      return false;
    }

    let coveredCount = 0;

    for (const header of headers) {
      if (
        header
          .getBoundingClientRect()
          .left >=
        coveredRight - 0.5
      ) {
        break;
      }

      coveredCount += 1;
    }

    return (
      !coveredCount ||
      slot > coveredCount
    );
  }

  function ensureSpacer(li) {
    let spacer =
      li.querySelector(
        ":scope > .structure-table-row-spacer"
      );

    if (spacer) {
      return spacer;
    }

    spacer =
      document.createElement("span");

    spacer.className =
      "structure-table-row-spacer";

    const childTree =
      li.querySelector(
        ":scope > ul[data-level]"
      );

    li.insertBefore(
      spacer,
      childTree || null
    );

    return spacer;
  }

  /*
    Все строки и заголовки уровней
    ищутся один раз при mount.

    Во время пересчёта больше нет
    querySelector для каждого id.
  */
  function buildSyncContext(root) {
    const {
      structureHeader,
      structureBody,
      table,
    } = getElements(root);

    if (
      !structureBody ||
      !table
    ) {
      return null;
    }

    const tableRows =
      Array.from(
        table.querySelectorAll(
          "tbody > tr[data-id]"
        )
      );

    const structureRows =
      Array.from(
        structureBody.querySelectorAll(
          ".row[data-id]"
        )
      );

    /*
  Берём только отображаемые элементы
  заголовков уровней.

  Сам li тоже имеет
  data-structure-table-level-node-id,
  но изменять его display нельзя:
  иначе вложенный ul становится соседним
  flex-элементом и каскад растягивается
  горизонтально.
*/
const levelItems =
  Array.from(
    structureBody.querySelectorAll(
      [
        ".level-header-column-item" +
          "[data-structure-table-level-node-id]",

        ".level-header-mini-item" +
          "[data-structure-table-level-node-id]",
      ].join(",")
    )
  );

    const tableRowsById =
      new Map();

    const structureRowsById =
      new Map();

    const levelItemsById =
      new Map();

    tableRows.forEach((row) => {
      const id =
        row.dataset.id || "";

      if (id) {
        tableRowsById.set(
          id,
          row
        );
      }
    });

    structureRows.forEach((row) => {
      const id =
        row.dataset.id || "";

      if (id) {
        structureRowsById.set(
          id,
          row
        );
      }
    });

    levelItems.forEach((item) => {
      const id =
        item.getAttribute(
          "data-structure-table-level-node-id"
        ) || "";

      if (
        id &&
        !levelItemsById.has(id)
      ) {
        levelItemsById.set(
          id,
          item
        );
      }
    });

    const pairs = [];

    tableRows.forEach((tableRow) => {
      const id =
        tableRow.dataset.id || "";

      const schemaRow =
        structureRowsById.get(id);

      const li =
        schemaRow?.closest("li");

      if (
        !id ||
        !li
      ) {
        return;
      }

      pairs.push({
        id,
        li,
        schemaRow,

        spacer:
          ensureSpacer(li),

        tableRow,

        levelItem:
          levelItemsById.get(id) ||
          null,
      });
    });

    return {
      root,
      structureHeader,
      structureBody,
      table,
      tableRows,
      structureRows,
      tableRowsById,
      structureRowsById,
      levelItems,
      pairs,
    };
  }

  function getCurrentContext(root) {
    if (
      mountedContext?.root === root &&
      mountedContext.table?.isConnected &&
      mountedContext
        .structureBody
        ?.isConnected
    ) {
      return mountedContext;
    }

    const context =
      buildSyncContext(root);

    if (root === mountedRoot) {
      mountedContext = context;
    }

    return context;
  }

  function readObservedSize(element) {
    if (!element) {
      return null;
    }

    const rect =
      element.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height,
    };
  }

  function rememberObservedSizes(
    context
  ) {
    if (!context) {
      return;
    }

    [
      context.structureHeader,
      context.structureBody,
      context.table,
    ].forEach((element) => {
      const size =
        readObservedSize(element);

      if (
        element &&
        size
      ) {
        observedSizes.set(
          element,
          size
        );
      }
    });
  }

  function hasRealObservedResize(
    entries
  ) {
    if (syncing) {
      return false;
    }

    return entries.some((entry) => {
      const element =
        entry.target;

      const previous =
        observedSizes.get(element);

      const current =
        readObservedSize(element);

      if (!current) {
        return false;
      }

      if (!previous) {
        return true;
      }

      return (
        Math.abs(
          current.width -
          previous.width
        ) > SIZE_EPSILON ||

        Math.abs(
          current.height -
          previous.height
        ) > SIZE_EPSILON
      );
    });
  }

  function resetLevelItem(item) {
    [
      "height",
      "min-height",
      "display",
      "align-items",
      "box-sizing",
    ].forEach((property) => {
      item.style.removeProperty(
        property
      );
    });

    item.style.removeProperty(
      "--structure-table-level-row-center"
    );

    const owner =
      item.closest(
        ".level-header-mini-li"
      );

    if (!owner) {
      return;
    }

    owner.style.removeProperty(
      "min-height"
    );

    owner.style.removeProperty(
      "--structure-table-level-row-center"
    );
  }

  function resetSizes(context) {
    context.structureHeader
      ?.style
      .removeProperty("height");

    context.table
      ?.tHead
      ?.style
      .removeProperty("height");

    context.pairs.forEach(
      ({
        spacer,
        tableRow,
      }) => {
        spacer.style.height =
          "0px";

        tableRow.style.height =
          "";

        tableRow.style.minHeight =
          "";
      }
    );

    context.levelItems.forEach(
      resetLevelItem
    );
  }

  function applyLevelHeaderHeight(
    item,
    height
  ) {
    if (!item) {
      return;
    }

    const safeHeight =
      Math.max(
        1,
        height
      );

    const value =
      `${safeHeight}px`;

    item.style.height =
      value;

    item.style.minHeight =
      value;

    item.style.boxSizing =
      "border-box";

    item.style.display =
      "flex";

    item.style.alignItems =
      "center";

    const owner =
      item.closest(
        ".level-header-mini-li"
      );

    if (!owner) {
      return;
    }

    owner.style.minHeight =
      value;

    owner.style.setProperty(
      "--structure-table-level-row-center",
      `${safeHeight / 2}px`
    );
  }

  function syncHeadHeights(
    structureHeader,
    table
  ) {
    const tableHead =
      table?.tHead;

    if (
      !structureHeader ||
      !tableHead
    ) {
      return;
    }

    /*
  Заголовок структуры может находиться:

  1. внутри настоящего th;
  2. в отдельной строке над таблицей.

  В обоих случаях его высоту нельзя
  переносить на thead таблицы.
*/
const integratedHeader =
  structureHeader.closest(
    'th[data-table-column-key="structure:tree"]'
  );

const externalHeaderRail =
  structureHeader.closest(
    ".structure-table-level-header-rail"
  );

if (
  integratedHeader ||
  externalHeaderRail
) {
  /*
    Удаляем высоту, которая могла
    сохраниться от предыдущего режима.
  */
  tableHead.style.removeProperty(
    "height"
  );

  structureHeader.style.removeProperty(
    "height"
  );

  return;
}

    const headerStyle =
      getComputedStyle(
        structureHeader
      );

    const borderHeight =
      (
        Number.parseFloat(
          headerStyle.borderTopWidth
        ) || 0
      ) +
      (
        Number.parseFloat(
          headerStyle.borderBottomWidth
        ) || 0
      );

    const naturalHeaderHeight =
      Math.ceil(
        structureHeader.scrollHeight +
        borderHeight
      );

    const naturalTableHeight =
      Math.ceil(
        tableHead
          .getBoundingClientRect()
          .height
      );

    const targetHeight =
      Math.max(
        22,
        naturalTableHeight,
        naturalHeaderHeight - 1
      );

    tableHead.style.height =
      `${targetHeight}px`;

    const actualHeight =
      Math.ceil(
        tableHead
          .getBoundingClientRect()
          .height
      );

    structureHeader.style.height =
      `${actualHeight + 1}px`;
  }

  /*
    Фаза 1:
    только чтение естественных
    размеров всех строк.
  */
  function measureNaturalRows(
    pairs
  ) {
    return pairs.map((pair) => {
      const liBox =
        pair.li
          .getBoundingClientRect();

      const spacerBox =
        pair.spacer
          .getBoundingClientRect();

      const tableBox =
        pair.tableRow
          .getBoundingClientRect();

      const structureHeight =
        Math.max(
          0,
          spacerBox.top -
          liBox.top
        );

      const targetHeight =
        Math.max(
          22,
          Math.ceil(
            structureHeight
          ),
          Math.ceil(
            tableBox.height
          )
        );

      return {
        pair,
        structureHeight,
        targetHeight,
      };
    });
  }

  /*
    Фаза 2:
    только запись высот.
  */
  function applyNaturalRows(
    measurements
  ) {
    measurements.forEach(
      ({
        pair,
        structureHeight,
        targetHeight,
      }) => {
        pair.spacer.style.height =
          `${Math.max(
            0,
            targetHeight -
            structureHeight
          )}px`;

        pair.tableRow.style.height =
          `${targetHeight}px`;

        applyLevelHeaderHeight(
          pair.levelItem,
          targetHeight
        );
      }
    );
  }

  /*
    Один общий контрольный read
    после округления высот таблицей.
  */
  function measureStabilizedRows(
    pairs
  ) {
    return pairs.map((pair) => {
      const liBox =
        pair.li
          .getBoundingClientRect();

      const spacerBox =
        pair.spacer
          .getBoundingClientRect();

      const tableBox =
        pair.tableRow
          .getBoundingClientRect();

      const structureHeight =
        Math.max(
          0,
          spacerBox.bottom -
          liBox.top
        );

      const tableHeight =
        tableBox.height;

      const targetHeight =
        Math.max(
          22,
          Math.ceil(
            structureHeight
          ),
          Math.ceil(
            tableHeight
          )
        );

      return {
        pair,
        structureHeight,
        tableHeight,
        targetHeight,
      };
    });
  }

  /*
    Один общий контрольный write.
  */
  function applyStabilizedRows(
    measurements
  ) {
    measurements.forEach(
      (measurement) => {
        const {
          pair,
          structureHeight,
          tableHeight,
          targetHeight,
        } = measurement;

        if (
          structureHeight <
          targetHeight - 0.01
        ) {
          const currentHeight =
            Number.parseFloat(
              pair.spacer.style.height
            ) || 0;

          pair.spacer.style.height =
            `${(
              currentHeight +
              targetHeight -
              structureHeight
            )}px`;
        }

        if (
          tableHeight <
          targetHeight - 0.01
        ) {
          pair.tableRow.style.height =
            `${targetHeight}px`;
        }

        applyLevelHeaderHeight(
          pair.levelItem,
          targetHeight
        );
      }
    );
  }

  /*
    Выделение обновляется отдельно,
    без пересчёта геометрии.
  */
  function syncSelection(
    root,
    suppliedContext = null
  ) {
    if (!root) {
      return;
    }

    const context =
      suppliedContext ||
      getCurrentContext(root);

    if (!context) {
      return;
    }

    const selectedCell =
      root.querySelector(
        ".structure-table-table-pane " +
        "td.table-cell-selected"
      );

    const selectedId =
      selectedCell
        ?.dataset
        ?.rowId ||

      selectedCell
        ?.closest("tr")
        ?.dataset
        ?.id ||

      window.selectedId ||
      "";

    context.tableRows.forEach(
      (tableRow) => {
        const id =
          tableRow.dataset.id ||
          "";

        tableRow.classList.toggle(
          "structure-table-active-row",
          id === selectedId
        );
      }
    );

    context.structureRows.forEach(
      (row) => {
        const id =
          row.dataset.id ||
          "";

        const tableRow =
          context
            .tableRowsById
            .get(id);

        row.classList.toggle(
          "sel",
          id === selectedId
        );

        row.classList.toggle(
          "multi",
          tableRow
            ?.classList
            .contains(
              "table-row-multi"
            ) === true
        );
      }
    );
  }

  function scheduleSelection() {
    if (
      selectionFrame ||
      !mountedRoot?.isConnected
    ) {
      return;
    }

    selectionFrame =
      requestAnimationFrame(() => {
        selectionFrame = 0;

        syncSelection(
          mountedRoot,
          mountedContext
        );
      });
  }

  function classTokenChanged(
    mutation,
    token
  ) {
    const before =
      String(
        mutation.oldValue ||
        ""
      )
        .split(/\s+/)
        .includes(token);

    const after =
      mutation.target
        ?.classList
        ?.contains(token) ===
      true;

    return before !== after;
  }

  function isSelectionMutation(
    mutation
  ) {
    if (
      mutation.type !==
        "attributes" ||

      mutation.attributeName !==
        "class"
    ) {
      return false;
    }

    return (
      classTokenChanged(
        mutation,
        "table-cell-selected"
      ) ||

      classTokenChanged(
        mutation,
        "table-row-multi"
      ) ||

      classTokenChanged(
        mutation,
        "is-selected"
      )
    );
  }

  /*
    Кнопки сначала измеряются,
    затем одним блоком переносятся.
  */
  function attachStructureControls(
    root,
    context
  ) {
    const host =
      root?.parentElement;

    const pane =
      root?.querySelector(
        ".structure-table-schema-pane"
      );

    if (
      !host ||
      !pane
    ) {
      return;
    }

    const selector = [
      ":scope > .level-collapse-bar",
      ":scope > .level-hide-bar",
      ":scope > .collapse-col",
      ":scope > .object-hide-col",
    ].join(",");

    const controls =
      Array.from(
        new Set([
          ...host.querySelectorAll(
            selector
          ),

          ...pane.querySelectorAll(
            selector
          ),
        ])
      );

    if (!controls.length) {
      return;
    }

    const hostBox =
      host.getBoundingClientRect();

    const paneBox =
      pane.getBoundingClientRect();

    /*
      Сначала только читаем
      положение всех строк.
    */
    const placements =
      controls.map((control) => {
        const isSideControl =
          control.classList.contains(
            "collapse-col"
          ) ||

          control.classList.contains(
            "object-hide-col"
          );

        if (!isSideControl) {
          return {
            control,
            isSideControl,
            top: null,
          };
        }

        const id =
          control.dataset.id ||
          "";

        const row =
          context
            ?.structureRowsById
            ?.get(id) ||

          (
            id
              ? pane.querySelector(
                  `.row[data-id="${cssEscapeLocal(id)}"]`
                )
              : null
          );

        if (
          row &&
          row.getClientRects().length
        ) {
          const rowBox =
  row.getBoundingClientRect();

const controlBox =
  control.getBoundingClientRect();

const controlHeight =
  controlBox.height || 20;

return {
  control,
  isSideControl,

  top:
    Math.round(
      rowBox.top -
      paneBox.top +
      (
        rowBox.height -
        controlHeight
      ) / 2
    ),
};
        }

        const oldTop =
          Number.parseFloat(
            control.style.top
          );

        const convertFromHost =
          control.parentElement ===
          host;

        return {
          control,
          isSideControl,

          top:
            Number.isFinite(oldTop)
              ? Math.round(
                  oldTop +
                  (
                    convertFromHost
                      ? hostBox.top -
                        paneBox.top
                      : 0
                  )
                )
              : null,
        };
      });

    /*
      Затем записываем стили
      и перемещаем DOM.
    */
    placements.forEach(
      ({
        control,
        isSideControl,
        top,
      }) => {
        if (isSideControl) {
          if (top !== null) {
            control.style.top =
              `${top}px`;
          }
        } else {
          control.style.top = "";
          control.style.left = "";
        }

        if (
          control.parentElement !==
          pane
        ) {
          pane.appendChild(control);
        }
      }
    );
  }

  function syncNow() {
    if (
      syncing ||
      !mountedRoot?.isConnected
    ) {
      return;
    }

    const root =
      mountedRoot;

    const context =
      getCurrentContext(root);

    if (
      !context.structureBody ||
      !context.table
    ) {
      return;
    }

    syncing = true;

    try {
      resetSizes(context);

      syncHeadHeights(
        context.structureHeader,
        context.table
      );

      /*
        Один блок чтения,
        затем один блок записи.
      */
      const naturalMeasurements =
        measureNaturalRows(
          context.pairs
        );

      applyNaturalRows(
        naturalMeasurements
      );

      syncSelection(
        root,
        context
      );

      if (
        root !== mountedRoot ||
        !root.isConnected
      ) {
        return;
      }

      syncHeadHeights(
        context.structureHeader,
        context.table
      );

      /*
        Один контрольный read/write
        после округления таблицей.
      */
      const stabilizedMeasurements =
        measureStabilizedRows(
          context.pairs
        );

      applyStabilizedRows(
        stabilizedMeasurements
      );

      window.levelHeaders
        ?.alignHeaderRowForSchema?.();

      window.levelHeaders
        ?.layoutColumnCascadeLines?.();

      window.structureTableColumn
        ?.layoutNow?.();

      window.schemaActiveBlock
        ?.layout?.();

      /*
        Во время изменения ширины
        оставляем старые линии.

        После отпускания мыши будет
        один финальный пересчёт.
      */
      if (
        document.body
          .classList
          .contains(
            "table-column-resizing"
          )
      ) {
        lineLayoutPending = true;
      } else {
        window.schemaLines
          ?.layoutNow?.();

        lineLayoutPending = false;
      }

      window.layoutCollapseColumn?.();

      attachStructureControls(
        root,
        context
      );

      rememberObservedSizes(
        context
      );
    } finally {
      if (root === mountedRoot) {
        syncing = false;
      }
    }
  }

  function schedule() {
    if (
      frame ||
      syncing ||
      !mountedRoot?.isConnected
    ) {
      return;
    }

    frame =
      requestAnimationFrame(() => {
        frame = 0;
        syncNow();
      });
  }

  function disconnect() {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(
      selectionFrame
    );

    frame = 0;
    selectionFrame = 0;

    resizeObserver?.disconnect?.();
    mutationObserver?.disconnect?.();

    resizeObserver = null;
    mutationObserver = null;
    mountedRoot = null;
    mountedContext = null;
    syncing = false;
    lineLayoutPending = false;
    observedSizes =
      new WeakMap();
  }

  function mount(root) {
    disconnect();

    if (!root) {
      return;
    }

    mountedRoot = root;

    mountedContext =
      buildSyncContext(root);

    const context =
      mountedContext;

    if (
      !context?.structureBody ||
      !context.table
    ) {
      return;
    }

    if (
      typeof ResizeObserver !==
      "undefined"
    ) {
      resizeObserver =
        new ResizeObserver(
          (entries) => {
            if (
              hasRealObservedResize(
                entries
              )
            ) {
              schedule();
            }
          }
        );

      if (
        context.structureHeader
      ) {
        resizeObserver.observe(
          context.structureHeader
        );
      }

      resizeObserver.observe(
        context.structureBody
      );

      resizeObserver.observe(
        context.table
      );
    }

    rememberObservedSizes(
      context
    );

    mutationObserver =
      new MutationObserver(
        (mutations) => {
          if (
            mutations.some(
              isSelectionMutation
            )
          ) {
            scheduleSelection();
          }
        }
      );

    mutationObserver.observe(
      context.table,
      {
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
        ],
        attributeOldValue: true,
      }
    );

    schedule();
  }

  function flushPendingLineLayout() {
    if (
      !lineLayoutPending ||
      !mountedRoot?.isConnected
    ) {
      return;
    }

    requestAnimationFrame(() => {
      if (
        lineLayoutPending &&
        mountedRoot?.isConnected
      ) {
        schedule();
      }
    });
  }

  window.addEventListener(
    "resize",
    schedule
  );

  window.addEventListener(
    "pointerup",
    flushPendingLineLayout,
    true
  );

  window.addEventListener(
    "pointercancel",
    flushPendingLineLayout,
    true
  );

  window.structureTableRowSync = {
    mount,
    disconnect,
    schedule,
    syncNow,
    syncSelection,
  };

  window.structureTableOcclusion = {
    getCoveredRight,
    isHeaderCovered,
    canUseDropSlot,
  };
})();