type TextControl = HTMLInputElement | HTMLTextAreaElement;

type EditableTarget =
  | { kind: 'text-control'; element: TextControl }
  | { kind: 'contenteditable'; element: HTMLElement };

type PasteSnapshot =
  | {
      kind: 'text-control';
      element: TextControl;
      value: string;
      selectionStart: number | null;
      selectionEnd: number | null;
    }
  | {
      kind: 'contenteditable';
      element: HTMLElement;
      html: string;
      range: Range | null;
    };

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

let forcePasteEnabled = false;

async function loadForcePasteSetting() {
  try {
    const result = await chrome.storage.local.get('settings');
    forcePasteEnabled = !!result.settings?.forcePasteEnabled;
  } catch {
    forcePasteEnabled = false;
  }
}

loadForcePasteSetting();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.settings) {
    return;
  }

  forcePasteEnabled = !!changes.settings.newValue?.forcePasteEnabled;
});

function isEditableInput(element: HTMLInputElement): boolean {
  return !element.disabled &&
    !element.readOnly &&
    !NON_TEXT_INPUT_TYPES.has(element.type.toLowerCase());
}

function isEditableTextArea(element: HTMLTextAreaElement): boolean {
  return !element.disabled && !element.readOnly;
}

function getEditingHost(element: HTMLElement): HTMLElement {
  let host = element;
  let parent = element.parentElement;

  while (parent?.isContentEditable) {
    host = parent;
    parent = parent.parentElement;
  }

  return host;
}

function findEditableTarget(event: ClipboardEvent): EditableTarget | null {
  for (const item of event.composedPath()) {
    if (item instanceof HTMLTextAreaElement && isEditableTextArea(item)) {
      return { kind: 'text-control', element: item };
    }

    if (item instanceof HTMLInputElement && isEditableInput(item)) {
      return { kind: 'text-control', element: item };
    }

    if (item instanceof HTMLElement && item.isContentEditable) {
      return { kind: 'contenteditable', element: getEditingHost(item) };
    }
  }

  return null;
}

function getSelectionRange(element: TextControl): { start: number; end: number } | null {
  try {
    if (
      typeof element.selectionStart === 'number' &&
      typeof element.selectionEnd === 'number'
    ) {
      return {
        start: element.selectionStart,
        end: element.selectionEnd,
      };
    }
  } catch {
    // Some input types do not expose text selection APIs.
  }

  return null;
}

function getEditableRange(element: HTMLElement): Range | null {
  const selection = element.ownerDocument.getSelection();
  if (!selection?.rangeCount) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const ancestor = range.commonAncestorContainer;

  if (ancestor === element || element.contains(ancestor)) {
    return range.cloneRange();
  }

  return null;
}

function createSnapshot(target: EditableTarget): PasteSnapshot {
  if (target.kind === 'contenteditable') {
    return {
      kind: 'contenteditable',
      element: target.element,
      html: target.element.innerHTML,
      range: getEditableRange(target.element),
    };
  }

  const selection = getSelectionRange(target.element);
  return {
    kind: 'text-control',
    element: target.element,
    value: target.element.value,
    selectionStart: selection?.start ?? null,
    selectionEnd: selection?.end ?? null,
  };
}

function hasChanged(snapshot: PasteSnapshot): boolean {
  if (snapshot.kind === 'contenteditable') {
    return snapshot.element.innerHTML !== snapshot.html;
  }

  return snapshot.element.value !== snapshot.value;
}

function focusWithoutScrolling(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function setNativeValue(element: TextControl, value: string) {
  const ownSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element),
    'value'
  )?.set;

  if (prototypeSetter && ownSetter !== prototypeSetter) {
    prototypeSetter.call(element, value);
    return;
  }

  if (ownSetter) {
    ownSetter.call(element, value);
    return;
  }

  element.value = value;
}

function dispatchInput(element: Element, text: string) {
  try {
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: text,
      inputType: 'insertFromPaste',
    }));
  } catch {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function insertIntoTextControl(snapshot: Extract<PasteSnapshot, { kind: 'text-control' }>, text: string) {
  const { element, selectionStart, selectionEnd, value } = snapshot;
  focusWithoutScrolling(element);

  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  const nextValue = value.slice(0, start) + text + value.slice(end);

  setNativeValue(element, nextValue);

  try {
    const nextCaret = start + text.length;
    element.setSelectionRange(nextCaret, nextCaret);
  } catch {
    // Some input types accept values but do not support caret placement.
  }

  dispatchInput(element, text);
}

function insertIntoContentEditable(
  snapshot: Extract<PasteSnapshot, { kind: 'contenteditable' }>,
  text: string
) {
  const { element, range } = snapshot;
  const document = element.ownerDocument;
  const selection = document.getSelection();

  focusWithoutScrolling(element);

  if (range && selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const activeRange = selection?.rangeCount ? selection.getRangeAt(0) : range;
  if (!activeRange) {
    element.append(document.createTextNode(text));
    dispatchInput(element, text);
    return;
  }

  activeRange.deleteContents();

  const textNode = document.createTextNode(text);
  activeRange.insertNode(textNode);
  activeRange.setStartAfter(textNode);
  activeRange.collapse(true);

  selection?.removeAllRanges();
  selection?.addRange(activeRange);
  dispatchInput(element, text);
}

function forcePaste(snapshot: PasteSnapshot, text: string) {
  if (!snapshot.element.isConnected) {
    return;
  }

  if (snapshot.kind === 'contenteditable') {
    insertIntoContentEditable(snapshot, text);
    return;
  }

  insertIntoTextControl(snapshot, text);
}

function handlePaste(event: ClipboardEvent) {
  if (!forcePasteEnabled) {
    return;
  }

  const text = event.clipboardData?.getData('text/plain');
  if (!text) {
    return;
  }

  const target = findEditableTarget(event);
  if (!target) {
    return;
  }

  const snapshot = createSnapshot(target);
  let sawInput = false;
  const markInput = () => {
    sawInput = true;
  };

  snapshot.element.addEventListener('input', markInput, {
    capture: true,
    once: true,
  });

  window.setTimeout(() => {
    snapshot.element.removeEventListener('input', markInput, { capture: true });

    if (sawInput || hasChanged(snapshot)) {
      return;
    }

    forcePaste(snapshot, text);
  }, 0);
}

document.addEventListener('paste', handlePaste, true);
