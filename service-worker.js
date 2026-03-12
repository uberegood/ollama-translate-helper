const DEFAULT_SETTINGS = {
  provider: 'ollama-generate',
  endpoint: 'http://10.20.30.3:11434/api/generate',
  model: 'translategemma:4b',
  apiKey: '',
  replaceSelection: true,
  translatePrompt:
    'Translate the following text into natural, professional English for a customer support reply. Return only translated text.',
  translateRuPrompt:
    'Translate the following text into natural Russian. Return only translated text.',
  paraphrasePrompt:
    'Paraphrase the following text in natural, professional English for a customer support reply. Keep the original meaning. Return only rewritten text.'
};

const CONTEXT_MENU_TRANSLATE = 'whmcs_ai_translate';
const CONTEXT_MENU_TRANSLATE_RU = 'whmcs_ai_translate_ru';
const CONTEXT_MENU_PARAPHRASE = 'whmcs_ai_paraphrase';

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === CONTEXT_MENU_TRANSLATE) {
    await triggerActionOnTab(tab.id, 'translate');
  }

  if (info.menuItemId === CONTEXT_MENU_TRANSLATE_RU) {
    await triggerActionOnTab(tab.id, 'translate_ru');
  }

  if (info.menuItemId === CONTEXT_MENU_PARAPHRASE) {
    await triggerActionOnTab(tab.id, 'paraphrase');
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'translate_selection') {
    await triggerActionOnTab(tab.id, 'translate');
  }
  if (command === 'paraphrase_selection') {
    await triggerActionOnTab(tab.id, 'paraphrase');
  }
  if (command === 'translate_selection_ru') {
    await triggerActionOnTab(tab.id, 'translate_ru');
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'AI_PROCESS_TEXT') {
    processText(message.action, message.text)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unknown error' }));

    return true;
  }

  if (message?.type === 'AI_TRIGGER_ACTION') {
    triggerActionOnTab(message.tabId, message.action)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unknown error' }));

    return true;
  }

  if (message?.type === 'AI_TEST_CONNECTION') {
    testConnection()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unknown error' }));

    return true;
  }
});

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_TRANSLATE,
      title: 'AI: Translate to English',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_TRANSLATE_RU,
      title: 'AI: Translate to Russian',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_PARAPHRASE,
      title: 'AI: Paraphrase in English',
      contexts: ['selection', 'editable']
    });
  });
}

async function triggerActionOnTab(tabId, action) {
  if (!tabId) {
    throw new Error('Tab not found');
  }

  await ensureContentScriptInjected(tabId);
  const targetFrameId = await findFrameWithSelection(tabId);
  const options = typeof targetFrameId === 'number' ? { frameId: targetFrameId } : undefined;

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'AI_OPERATION', action }, options);
    if (!response?.ok) {
      throw new Error(response?.error || 'Failed to process selected text');
    }
    return response.result;
  } catch (error) {
    throw new Error(error?.message || 'Operation failed. Check text selection and reload the tab.');
  }
}

async function ensureContentScriptInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'AI_HAS_SELECTION' });
    return;
  } catch {
    // content-script is likely not present on this tab yet
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content-script.js']
    });
  } catch {
    throw new Error(
      'Could not connect to this page (Receiving end does not exist). Reload the tab and try again. ' +
        'The extension does not work on chrome:// pages.'
    );
  }
}

async function findFrameWithSelection(tabId) {
  let frames = [];
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId });
  } catch {
    return undefined;
  }

  for (const frame of frames) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: 'AI_HAS_SELECTION' }, { frameId: frame.frameId });
      if (res?.ok && res.hasSelection) {
        return frame.frameId;
      }
    } catch {
      // Ignore frame without content-script access
    }
  }

  return undefined;
}

async function processText(action, text) {
  if (!text || !text.trim()) {
    throw new Error('No text to process.');
  }

  const settings = await getSettings();
  const instruction =
    action === 'translate'
      ? settings.translatePrompt
      : action === 'translate_ru'
      ? settings.translateRuPrompt
      : settings.paraphrasePrompt;
  const prompt = `${instruction}\n\nText:\n${text.trim()}`;

  if (settings.provider === 'openai-chat') {
    return await requestOpenAIChat(settings, instruction, text.trim());
  }

  return await requestOllamaGenerate(settings, prompt);
}

async function requestOllamaGenerate(settings, prompt) {
  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey?.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model,
      prompt,
      stream: false,
      options: { temperature: 0.2 }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403) {
      throw new Error(
        'Ollama returned 403 (api forbidden). Most often this is an Origin restriction for chrome-extension://. ' +
          'Either allow this origin in Ollama (OLLAMA_ORIGINS), or use OpenAI-style provider through Open WebUI ' +
          '(endpoint http://localhost:3000/api/chat/completions).'
      );
    }
    throw new Error(`API error (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  if (!data?.response) {
    throw new Error('Empty model response.');
  }

  return data.response.trim();
}

async function requestOpenAIChat(settings, systemPrompt, text) {
  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey?.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty model response.');
  }
  return content.trim();
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function testConnection() {
  const settings = await getSettings();

  if (settings.provider === 'openai-chat') {
    await requestOpenAIChat(settings, 'You are a concise assistant. Reply with OK only.', 'ping');
    return 'Open WebUI / OpenAI-style: connection successful';
  }

  await requestOllamaGenerate(settings, 'Reply with OK only.');
  return 'Ollama: connection successful';
}

async function ensureDefaults() {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const patch = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof current[key] === 'undefined') {
      patch[key] = value;
    }
  }

  if (Object.keys(patch).length > 0) {
    await chrome.storage.sync.set(patch);
  }
}
