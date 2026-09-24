// table/table_column_width_dialog.js
// Модальное изменение ширины колонки:
// - точное значение в пикселях;
// - автоподбор по содержимому.

(function () {
  if (typeof window === "undefined") return;

  const MODE_PIXELS = "pixels";
  const MODE_AUTO = "auto";

  let backdrop = null;
  let currentContext = null;

  function element(
    tag,
    className,
    text
  ) {
    const node =
      document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  function close() {
    if (!backdrop) return;

    backdrop.hidden = true;
    backdrop.classList.remove(
      "is-open"
    );

    currentContext = null;
  }

  function selectedMode() {
    return (
      backdrop
        ?.querySelector(
          'input[name="tableColumnWidthMode"]:checked'
        )
        ?.value ||
      MODE_PIXELS
    );
  }

  function syncMode() {
  if (!backdrop) return;

  syncRadioIndicators();

  const input =
    backdrop.querySelector(
      "#tableColumnWidthInput"
    );

  if (input) {
    input.disabled =
      selectedMode() !==
      MODE_PIXELS;
  }
}

  function showError(text) {
    const error =
      backdrop?.querySelector(
        "#tableColumnWidthError"
      );

    if (error) {
      error.textContent =
        text || "";

      error.hidden =
        !text;
    }
  }

  function syncRadioIndicators() {
  backdrop
    ?.querySelectorAll(
      ".table-column-width-option"
    )
    .forEach(
      (option) => {
        const input =
          option.querySelector(
            'input[type="radio"]'
          );

        const indicator =
          option.querySelector(
            ".view-settings-interface-radio"
          );

        indicator?.classList.toggle(
          "is-selected",
          input?.checked === true
        );
      }
    );
}

  function save() {
    const context =
      currentContext;

    const resize =
      window.tableColumnResize;

    if (
      !context ||
      !resize
    ) {
      close();
      return;
    }

    let appliedWidth = 0;

    if (
      selectedMode() ===
      MODE_AUTO
    ) {
      appliedWidth =
        resize.autoFit?.(
          context.table,
          context.columnKey,
          {
            save: true,
          }
        ) || 0;
    } else {
      const input =
        backdrop.querySelector(
          "#tableColumnWidthInput"
        );

      const value =
        Number(input?.value);

      const minimum =
        resize.getMinimumWidth?.() ||
        25;

      const maximum =
        resize.getMaximumWidth?.() ||
        10000;

      if (
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < minimum ||
        value > maximum
      ) {
        showError(
          `Введите целое число от ${minimum} до ${maximum}.`
        );

        input?.focus({
          preventScroll: true,
        });

        return;
      }

      appliedWidth =
        resize.setWidth?.(
          context.table,
          context.columnKey,
          value,
          {
            save: true,
          }
        ) || 0;
    }

    if (!appliedWidth) {
      showError(
        "Не удалось изменить ширину колонки."
      );
      return;
    }

    close();
  }

  function createOption(
  value,
  text,
  checked = false
) {
  const label =
    element(
      "label",
      "table-column-width-option"
    );

  const radio =
    document.createElement(
      "input"
    );

  radio.type =
    "radio";

  radio.name =
    "tableColumnWidthMode";

  radio.value =
    value;

  radio.checked =
    checked;

  radio.className =
    "table-column-width-native-radio";

  /*
    Это тот же визуальный компонент,
    который используется в предыдущих
    окнах настроек.
  */

  const indicator =
    element(
      "span",
      (
        "view-settings-interface-radio " +
        "table-column-width-radio"
      )
    );

  indicator.setAttribute(
    "aria-hidden",
    "true"
  );

  const caption =
    element(
      "span",
      "",
      text
    );

  radio.addEventListener(
    "change",
    syncMode
  );

  label.append(
    radio,
    indicator,
    caption
  );

  return label;
}

  function createDialog() {
    backdrop =
      element(
        "div",
        "property-delete-backdrop " +
        "table-column-width-backdrop"
      );

    backdrop.id =
      "tableColumnWidthBackdrop";

    backdrop.hidden = true;

    const modal =
      element(
        "form",
        "property-delete-modal " +
        "table-column-width-modal"
      );

    modal.setAttribute(
      "role",
      "dialog"
    );

    modal.setAttribute(
      "aria-modal",
      "true"
    );

    const title =
      element(
        "div",
        "property-delete-title " +
        "table-column-width-title"
      );

    title.id =
      "tableColumnWidthTitle";

    const body =
      element(
        "div",
        "table-column-width-body"
      );

const pixelsOption =
  createOption(
    MODE_PIXELS,
    "Ширина колонки в пикселях",
    true
  );

const input =
  document.createElement(
    "input"
  );

input.id =
  "tableColumnWidthInput";

input.className =
  "table-column-width-input";

input.type =
  "number";

input.min =
  "25";

input.max =
  "10000";

input.step =
  "1";

input.placeholder =
  "Введите текст (по умолчанию: 60)";

/*
  Сначала создаём поле,
  затем добавляем его в группу.
*/

const pixelsGroup =
  element(
    "div",
    "table-column-width-pixels"
  );

pixelsGroup.append(
  pixelsOption,
  input
);

    const autoOption =
      createOption(
        MODE_AUTO,
        "Автоподбор по максимальной ширине текста"
      );

    const error =
      element(
        "div",
        "table-column-width-error"
      );

    error.id =
      "tableColumnWidthError";
    error.hidden = true;

    const actions =
      element(
        "div",
        "property-delete-actions"
      );

    const saveButton =
  element(
    "button",
    (
      "btnn save " +
      "table-column-width-save"
    ),
    "Сохранить"
  );

    saveButton.type = "submit";

    const cancelButton =
  element(
    "button",
    (
      "btnn dontsave " +
      "table-column-width-cancel"
    ),
    "Не сохранять"
  );

    cancelButton.type = "button";
    cancelButton.addEventListener(
      "click",
      close
    );

    actions.append(
      saveButton,
      cancelButton
    );

    body.append(
  pixelsGroup,
  autoOption,
  error
);

    modal.append(
      title,
      body,
      actions
    );

    backdrop.appendChild(
  modal
);

    modal.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        save();
      }
    );

    backdrop.addEventListener(
      "pointerdown",
      (event) => {
        if (
          event.target ===
          backdrop
        ) {
          close();
        }
      }
    );

    document.body.appendChild(
      backdrop
    );

    return backdrop;
  }

  function open({
    table,
    columnKey,
    title,
  }) {
    if (
      !table ||
      !columnKey ||
      !window.tableColumnResize
    ) {
      return false;
    }

    const root =
      backdrop ||
      createDialog();

    currentContext = {
      table,
      columnKey,
    };

    const titleElement =
      root.querySelector(
        "#tableColumnWidthTitle"
      );

    titleElement.textContent =
      `Изменить размер колонки «${
        title || columnKey
      }»`;

    const pixelsRadio =
      root.querySelector(
        'input[value="pixels"]'
      );

    const autoRadio =
      root.querySelector(
        'input[value="auto"]'
      );

    pixelsRadio.checked = true;
    autoRadio.checked = false;

    const input =
  root.querySelector(
    "#tableColumnWidthInput"
  );

input.value = "";

    showError("");
    syncMode();

    root.hidden = false;
    root.classList.add(
      "is-open"
    );

    requestAnimationFrame(() => {
      input.focus({
        preventScroll: true,
      });
      input.select?.();
    });

    return true;
  }

  window.tableColumnWidthDialog = {
    open,
    close,
  };

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        backdrop &&
        !backdrop.hidden
      ) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    true
  );
})();