// structure_table/structure_table_view.js
// Объединённый вид: структура является обычной колонкой таблицы.

(function () {
  if (typeof window === "undefined") return;

  const STRUCTURE_COLUMN_KEY = "structure:tree";

  const STRUCTURE_COLUMN_DESCRIPTOR = {
    title: "Структура",
    tableColumnKey: STRUCTURE_COLUMN_KEY,
    alwaysVisible: true,
    isStructureTableColumn: true,
  };

  const STRUCTURE_PROPERTY_KEYS = new Set([
    "name",
    "captions",
    "marks",
    "ordinals",
  ]);

  function belongsToStructure(descriptor) {
    const keys = Array.isArray(descriptor?.settingKeys)
      ? descriptor.settingKeys
      : [];

    return keys.some((key) => STRUCTURE_PROPERTY_KEYS.has(key));
  }

  function shouldRenderInTable(descriptor) {
    const renderer = window.tableViewRenderer;

    return !!(
      descriptor &&
      !belongsToStructure(descriptor) &&
      renderer?.isColumnVisible?.(descriptor) !== false
    );
  }

  function removeStructureCells(row, descriptors) {
    for (
      let index = descriptors.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (shouldRenderInTable(descriptors[index])) {
        continue;
      }

      row.children[index]?.remove();
    }
  }

  function getDisplayRoot() {
    return (
      window.objectFocus?.getFocusedRootNode?.() ||
      window.root
    );
  }

  function getDisplayOrdinalPath() {
    return (
      window.objectFocus?.getFocusedRootOrdinalPath?.() ||
      []
    );
  }

  function getActiveViewItem() {
    const direct =
      window.viewSettings?.getActiveItem?.();

    if (direct) {
      return direct;
    }

    const state =
      window.viewTabs?.normalizeState?.() ||
      window.viewTabsState;

    if (
      !state ||
      !Array.isArray(state.items)
    ) {
      return null;
    }

    return (
      state.items.find(
        (item) =>
          item.id === state.activeId
      ) ||
      state.items[0] ||
      null
    );
  }

  /*
    Если порядок колонок был сохранён
    до появления структуры как столбца,
    добавляем её в начало.
  */
  function ensureStructureColumnOrder() {
    const item = getActiveViewItem();

    if (!item) {
      return;
    }

    if (
      !item.settings ||
      typeof item.settings !== "object"
    ) {
      item.settings = {};
    }

    const order =
      item.settings.tableColumnOrder;

    if (
      !Array.isArray(order) ||
      !order.length ||
      order.includes(STRUCTURE_COLUMN_KEY)
    ) {
      return;
    }

    item.settings.tableColumnOrder = [
      STRUCTURE_COLUMN_KEY,
      ...order,
    ];

    window.projectAutosave?.saveNow?.();
  }

  function buildStructurePane(
    displayRoot,
    ordinalPath
  ) {
    const pane =
      document.createElement("section");

    pane.className =
      "structure-table-schema-pane";

    const header =
      document.createElement("div");

    header.className =
      "structure-table-schema-header";

    const body =
      document.createElement("div");

    body.className =
      "structure-table-schema-body";

    const tree =
      document.createElement("ul");

    tree.dataset.level =
      String(displayRoot.level);

    if (
      displayRoot.id !==
      window.root.id
    ) {
      tree.classList.add("focus-root");
    }

    tree.appendChild(
      window.renderNode(
        displayRoot,
        ordinalPath,
        {
          suppressOwnOrdinal:
            displayRoot.id !==
            window.root.id,

          forceRootClass:
            displayRoot.id !==
            window.root.id,

          suppressTextProperties: true,
        }
      )
    );

    const levelHeadersBlock =
      window.levelHeaders
        ?.buildHeaderRowForSchema?.() ||
      window.levelHeaders
        ?.buildHeaderCascadeForSchema?.();

    const levelHeadersColumn =
      window.levelHeaders
        ?.buildColumnStackForSchema?.() ||
      window.levelHeaders
        ?.buildColumnCascadeForSchema?.();

    if (levelHeadersBlock) {
      header.classList.add(
        "has-level-headers"
      );

      header.appendChild(
        levelHeadersBlock
      );
    } else {
      header.textContent =
        "Структура";
    }

    if (levelHeadersColumn) {
      const contentWrap =
        document.createElement("div");

      contentWrap.className =
        "schema-with-level-column";

      contentWrap.append(
        levelHeadersColumn,
        tree
      );

      body.appendChild(
        contentWrap
      );
    } else {
      body.appendChild(tree);
    }

    pane.append(
      header,
      body
    );

    pane.addEventListener(
      "pointerdown",
      () => {
        window.tableCellInnerMode
          ?.clear?.();
      },
      true
    );

    return pane;
  }

  /*
    Настоящая пустая td нужна для того,
    чтобы resize и reorder работали со
    структурой как с обычной колонкой.
  */
  function createStructureCell() {
    const cell =
      document.createElement("td");

    cell.className =
      "structure-table-structure-cell";

    cell.dataset.cellKey =
      "__structure__";

    cell.dataset.tableColumnKey =
      STRUCTURE_COLUMN_KEY;

    cell.setAttribute(
      "aria-hidden",
      "true"
    );

    return cell;
  }

  function buildTablePane(
    displayRoot,
    ordinalPath
  ) {
    const renderer =
      window.tableViewRenderer;

    const descriptors =
      renderer.getColumnDescriptors();

    const propertyDescriptors =
      descriptors.filter(
        shouldRenderInTable
      );

    const visibleDescriptors = [
      STRUCTURE_COLUMN_DESCRIPTOR,
      ...propertyDescriptors,
    ];

    const pane =
      document.createElement("section");

    pane.className =
      "structure-table-table-pane";

    const wrap =
      document.createElement("div");

    wrap.className =
      "table-view structure-table-property-view";

    const table =
      document.createElement("table");

    table.className =
      "structure-table";

    renderer.applyTextSettings(table);

    table.appendChild(
      renderer.buildHead(
        visibleDescriptors
      )
    );

    const tbody =
      document.createElement("tbody");

    const rows =
      window.flattenTableRows(
        displayRoot,
        ordinalPath
      );

    rows.forEach((item) => {
      const row =
        window.renderTableRow(
          item.node,
          item.ordinalPath
        );

      removeStructureCells(
        row,
        descriptors
      );

      row.prepend(
        createStructureCell()
      );

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    pane.appendChild(wrap);

    return {
      pane,
      table,
    };
  }

  /*
    Переносим настоящий заголовок структуры
    внутрь созданного th.
  */
 /*
  Настоящий th остаётся в таблице:
  он нужен для resize и reorder.

  Визуальный заголовок структуры живёт
  в отдельном слое поверх th либо
  в отдельной строке над таблицей.
*/
/*
  Заголовок «Структура» остаётся
  настоящей ячейкой th.

  Если сверху находятся заголовки уровней,
  они будут вынесены в отдельную строку
  функцией buildLevelHeaderRail().
*/
function connectStructureHeader(
  structurePane,
  table
) {
  const headerCell =
    table.querySelector(
      (
        'thead th[' +
        'data-table-column-key="' +
        STRUCTURE_COLUMN_KEY +
        '"]'
      )
    );

  if (!headerCell) {
    return null;
  }

  headerCell.classList.add(
    "structure-table-structure-header-cell"
  );

  /*
    Ничего из th не удаляем.

    Созданный table_view.js элемент
    .table-column-header-label уже содержит
    настоящее название «Структура».
  */

  headerCell.setAttribute(
    "aria-label",
    "Структура"
  );

  /*
    Если верхних заголовков уровней нет,
    отдельный визуальный заголовок больше
    не нужен — название уже находится в th.
  */

  const separateHeader =
    structurePane.querySelector(
      (
        ":scope > " +
        ".structure-table-schema-header" +
        ":not(.has-level-headers)"
      )
    );

  separateHeader?.remove();

  return headerCell;
}

/*
  Если выбран верхний режим заголовков,
  переносим их в отдельную строку
  перед всей таблицей.

  Сам блок остаётся привязанным
  к структурному столбцу.
*/
function buildLevelHeaderRail(
  view,
  structurePane
) {
  const structureHeader =
    structurePane.querySelector(
      ".structure-table-schema-header.has-level-headers"
    );

  if (!structureHeader) {
    return null;
  }

  const rail =
    document.createElement(
      "div"
    );

  rail.className =
    "structure-table-level-header-rail";

  /*
    Переносим блок заголовков уровней
    в отдельную строку над таблицей.
  */
  rail.appendChild(
    structureHeader
  );

  view.classList.add(
    "structure-table-has-top-level-headers"
  );

  return rail;
}

  function mountTableBehavior(table) {
    window.tableColumnResize
      ?.mount?.(table);

    window.tableColumnReorder
      ?.mount?.(table);

    window.ensureTableCellTabNavigation
      ?.();

    window.ensureTableTimerCellsEnterHotkey
      ?.();

    window.ensureTableUploadCellsEnterHotkey
      ?.();

    window.tableCellNav
      ?.prepareTableCells?.();

    window.tableMultiSelect
      ?.refresh?.();

    window.updateTableDescendantRowHighlights
      ?.();

    window.ensureTableDescendantHighlightWatcher
      ?.();
  }


  /*
    Дерево остаётся единым вложенным DOM.

    Его панель располагается поверх пустых
    td структуры и следует за настоящим th
    при изменении ширины и порядка.
  */
  function mountStructureColumnLayout(
    view,
    structurePane,
    table
  ) {
    window.structureTableColumn
      ?.disconnect?.();

    let frame = 0;
    let observer = null;

    function getHeaderCell() {
      return table.querySelector(
        `thead th[data-table-column-key="${STRUCTURE_COLUMN_KEY}"]`
      );
    }

    function layoutNow() {
      if (
        !view.isConnected ||
        !structurePane.isConnected ||
        !table.isConnected
      ) {
        return;
      }

      const headerCell =
        getHeaderCell();

      const tableHead =
        table.tHead;

      const tableBody =
        table.tBodies?.[0];

      if (
        !headerCell ||
        !tableHead ||
        !tableBody
      ) {
        return;
      }

      const viewBox =
        view.getBoundingClientRect();

      const tableBox =
        table.getBoundingClientRect();

      const headerBox =
        headerCell.getBoundingClientRect();

      const bodyBox =
        tableBody.getBoundingClientRect();

      structurePane.style.left =
        `${Math.round(
          headerBox.left -
          viewBox.left
        )}px`;

      structurePane.style.top =
        `${Math.round(
          tableBox.top -
          viewBox.top
        )}px`;

      structurePane.style.width =
        `${headerBox.width}px`;

      structurePane.style.paddingTop =
        `${Math.max(
          0,
          bodyBox.top -
          tableBox.top
        )}px`;

      structurePane.style.minHeight =
        `${tableBox.height}px`;

        /*
  Визуальный заголовок либо закрывает
  настоящий th, либо находится в строке
  над таблицей.
*/
const structureHeader =
  view.querySelector(
    ".structure-table-schema-header"
  );

if (structureHeader) {
  const headerRail =
    structureHeader.closest(
      ".structure-table-level-header-rail"
    );

  structureHeader.style.width =
    `${headerBox.width}px`;

  if (headerRail) {
    structureHeader.style.left =
      "0px";

    structureHeader.style.top =
      "0px";

    structureHeader.style.height =
      "";

    structureHeader.style.marginLeft =
      `${Math.round(
        headerBox.left -
        viewBox.left
      )}px`;

    /*
      Высота может отличаться:
      обычная строка — 24px,
      каскад — значительно выше.
    */
    const railHeight =
      Math.ceil(
        headerRail
          .getBoundingClientRect()
          .height
      );

    view.style.setProperty(
      "--structure-table-top-headers-height",
      `${railHeight}px`
    );
  } else {
    view.style.removeProperty(
      "--structure-table-top-headers-height"
    );

    structureHeader.style.marginLeft =
      "0px";

    structureHeader.style.top =
      `${Math.round(
        headerBox.top -
        tableBox.top
      )}px`;

    structureHeader.style.height =
      `${headerBox.height}px`;
  }
}

      const structureBody =
        structurePane.querySelector(
          ".structure-table-schema-body"
        );

      if (structureBody) {
        structureBody.style.width =
          "100%";

        structureBody.style.minHeight =
          `${bodyBox.height}px`;
      }
    }

    function schedule() {
      if (!view.isConnected) {
        disconnect();
        return;
      }

      if (frame) {
        return;
      }

      frame =
        requestAnimationFrame(() => {
          frame = 0;
          layoutNow();
        });
    }

    function observeCurrentElements() {
      observer?.disconnect?.();

      if (
        typeof ResizeObserver ===
        "undefined"
      ) {
        return;
      }

      observer =
        new ResizeObserver(schedule);

      const headerCell =
        getHeaderCell();

      if (headerCell) {
        observer.observe(headerCell);
      }

      if (table.tHead) {
        observer.observe(table.tHead);
      }

      const tableBody =
        table.tBodies?.[0];

      if (tableBody) {
        observer.observe(tableBody);
      }
    }

    function handleOrderChange() {
      if (!view.isConnected) {
        disconnect();
        return;
      }

      observeCurrentElements();
      layoutNow();
    }

    function disconnect() {
      cancelAnimationFrame(frame);
      frame = 0;

      observer?.disconnect?.();
      observer = null;

      window.removeEventListener(
        "resize",
        schedule
      );

      window.removeEventListener(
        "table-column-order-change",
        handleOrderChange
      );
    }

    window.addEventListener(
      "resize",
      schedule
    );

    window.addEventListener(
      "table-column-order-change",
      handleOrderChange
    );

    observeCurrentElements();
    layoutNow();

    window.structureTableColumn = {
      key: STRUCTURE_COLUMN_KEY,
      layout: schedule,
      layoutNow,
      disconnect,
    };
  }

  window.renderStructureTableView =
    function renderStructureTableView() {
      window.syncProjectsSidebar?.();

      const host =
        document.getElementById("tree");

      if (
        !host ||
        !window.tableViewRenderer ||
        typeof window.renderNode !==
          "function" ||
        typeof window.flattenTableRows !==
          "function" ||
        typeof window.renderTableRow !==
          "function"
      ) {
        return;
      }

      const displayRoot =
        getDisplayRoot();

      const ordinalPath =
        getDisplayOrdinalPath();

      if (!displayRoot) {
        return;
      }

      window.structureTableColumn
        ?.disconnect?.();

      ensureStructureColumnOrder();

      const view =
        document.createElement("div");

      view.className =
        "structure-table-combined-view " +
        "structure-table-integrated-columns";

      const structurePane =
        buildStructurePane(
          displayRoot,
          ordinalPath
        );

      const {
        pane: tablePane,
        table,
      } = buildTablePane(
        displayRoot,
        ordinalPath
      );

      connectStructureHeader(
  structurePane,
  table
);

const levelHeaderRail =
  buildLevelHeaderRail(
    view,
    structurePane
  );

/*
  Верхние заголовки располагаются
  отдельной строкой перед таблицей.

  В режимах «в колонке» отдельной
  верхней строки нет.
*/
if (levelHeaderRail) {
  view.append(
    levelHeaderRail,
    tablePane,
    structurePane
  );
} else {
  view.append(
    tablePane,
    structurePane
  );
}

      host.replaceChildren(view);

mountTableBehavior(table);

mountStructureColumnLayout(
  view,
  structurePane,
  table
);

      window.levelHeaders
        ?.alignHeaderRowForSchema?.();

      window.levelHeaders
        ?.layoutColumnCascadeLines?.();

      window.markProperty
        ?.refresh?.();

      window.hideLevels
        ?.layout?.();

      window.hideNodes
        ?.refresh?.();

      window.schemaActiveBlock
        ?.layout?.();

      window.layoutCollapseColumn
        ?.();

      window.layoutLevelCollapseBar
        ?.();

      window.structureTableRowSync
        ?.mount?.(view);

      requestAnimationFrame(() => {
        window.objectFocus
          ?.renderBreadcrumbs?.();

        const renameId =
          window.consumeRenameRequest?.();

        if (renameId) {
          window.startRename?.(
            renameId
          );
        }
      });
    };

  if (
    !window
      .__structureTableSettingsBound
  ) {
    window
      .__structureTableSettingsBound =
        true;

    const rerender = () => {
      if (
        window.currentView !==
        window.VIEW?.STRUCTURE_TABLE
      ) {
        return;
      }

      requestAnimationFrame(() => {
        window.renderStructureTableView
          ?.();
      });
    };

    window.addEventListener(
      "view-property-settings-change",
      rerender
    );

    window.addEventListener(
      "view-interface-settings-change",
      rerender
    );
  }
})();