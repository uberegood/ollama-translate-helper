let lastFocusedEditable = null;

document.addEventListener('focusin', (event) => {
  const target = event.target;
  if (isEditable(target)) {
    lastFocusedEditable = target;
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'AI_OPERATION') {
    runOperation(message.action)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unknown error' }));
    return true;
  }

  if (message?.type === 'GET_SELECTION_TEXT') {
    const selectedText = getSelectedText();
    sendResponse({ ok: true, selectedText });
    return false;
  }

  if (message?.type === 'REPLACE_WITH_TEXT') {
    const ok = replaceSelectedText(message.text || '');
    sendResponse({ ok });
    return false;
  }

  if (message?.type === 'AI_HAS_SELECTION') {
    const selectedText = getSelectedText();
    sendResponse({ ok: true, hasSelection: !!selectedText.trim() });
    return false;
  }
});

async function runOperation(action) {
  const selectedText = getSelectedText();
  if (!selectedText.trim()) {
    throw new Error('Please select text in an input field or on the page.');
  }

  showToast('Processing text...');

  const response = await chrome.runtime.sendMessage({
    type: 'AI_PROCESS_TEXT',
    action,
    text: selectedText
  });

  if (!response?.ok) {
    throw new Error(response?.error || 'Text processing failed');
  }

  if (action === 'translate_ru') {
    showResultModal(response.result, 'Russian Translation');
    showToast('Translation is shown in a separate window.');
    return response.result;
  }

  const { replaceSelection } = await chrome.storage.sync.get(['replaceSelection']);
  const shouldReplace = typeof replaceSelection === 'boolean' ? replaceSelection : true;

  if (shouldReplace) {
    const replaced = replaceSelectedText(response.result);
    if (!replaced) {
      await copyToClipboard(response.result);
      showToast('Done. Text copied to clipboard.');
      return response.result;
    }
    showToast('Text updated.');
    return response.result;
  }

  await copyToClipboard(response.result);
  showToast('Done. Result copied to clipboard.');
  return response.result;
}

function getSelectedText() {
  const active = document.activeElement;

  if (isTextInput(active)) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    return active.value.slice(start, end);
  }

  if (isContentEditable(active)) {
    return window.getSelection()?.toString() || '';
  }

  return window.getSelection()?.toString() || '';
}

function replaceSelectedText(text) {
  const active = document.activeElement;
  const editable = isEditable(active) ? active : lastFocusedEditable;

  if (!editable) return false;

  if (isTextInput(editable)) {
    const start = editable.selectionStart ?? editable.value.length;
    const end = editable.selectionEnd ?? editable.value.length;
    const newValue = editable.value.slice(0, start) + text + editable.value.slice(end);
    editable.value = newValue;

    const cursor = start + text.length;
    editable.selectionStart = cursor;
    editable.selectionEnd = cursor;
    editable.dispatchEvent(new Event('input', { bubbles: true }));
    editable.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (isContentEditable(editable)) {
    editable.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      editable.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    document.execCommand('insertText', false, text);
    editable.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
}

function isEditable(element) {
  return isTextInput(element) || isContentEditable(element);
}

function isTextInput(element) {
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'TEXTAREA' || (tag === 'INPUT' && /^(text|search|email|url|tel)$/i.test(element.type));
}

function isContentEditable(element) {
  return !!element && element.isContentEditable;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function showToast(text) {
  const id = 'whmcs-ai-toast';
  let toast = document.getElementById(id);

  if (!toast) {
    toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      background: #111827;
      color: #fff;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px;
      box-shadow: 0 10px 24px rgba(0,0,0,.25);
      font-family: Arial, sans-serif;
      max-width: 360px;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast?.remove();
  }, 2400);
}

function showResultModal(text, title = 'Result') {
  const old = document.getElementById('ollama-translate-helper-modal');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ollama-translate-helper-modal';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    width: min(820px, 100%);
    max-height: 85vh;
    overflow: auto;
    background: #ffffff;
    color: #111827;
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
    padding: 14px;
    font-family: Arial, sans-serif;
  `;

  const heading = document.createElement('h3');
  heading.textContent = title;
  heading.style.cssText = 'margin:0 0 10px 0; font-size:18px;';

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = `
    width: 100%;
    min-height: 220px;
    resize: vertical;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 10px;
    box-sizing: border-box;
    font-size: 14px;
    line-height: 1.4;
  `;

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex; gap:8px; margin-top:10px;';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.style.cssText = buttonStyle(false);
  copyBtn.addEventListener('click', async () => {
    await copyToClipboard(textarea.value);
    copyBtn.textContent = 'Copied ✅';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = buttonStyle(true);
  closeBtn.addEventListener('click', () => overlay.remove());

  actions.append(copyBtn, closeBtn);
  modal.append(heading, textarea, actions);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

function buttonStyle(primary) {
  return `
    border: 1px solid ${primary ? '#2563eb' : '#d1d5db'};
    background: ${primary ? '#2563eb' : '#fff'};
    color: ${primary ? '#fff' : '#111827'};
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
  `;
}
