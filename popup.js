const statusEl = document.getElementById('status');
const translateBtn = document.getElementById('translateBtn');
const translateRuBtn = document.getElementById('translateRuBtn');
const paraphraseBtn = document.getElementById('paraphraseBtn');
const openOptionsBtn = document.getElementById('openOptions');
const saveQuickSettingsBtn = document.getElementById('saveQuickSettings');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const providerEl = document.getElementById('provider');
const endpointEl = document.getElementById('endpoint');
const modelEl = document.getElementById('model');
const replaceSelectionEl = document.getElementById('replaceSelection');

const QUICK_DEFAULTS = {
  provider: 'ollama-generate',
  endpoint: 'http://10.20.30.3:11434/api/generate',
  model: 'translategemma:4b',
  replaceSelection: true
};

translateBtn.addEventListener('click', () => run('translate'));
translateRuBtn.addEventListener('click', () => run('translate_ru'));
paraphraseBtn.addEventListener('click', () => run('paraphrase'));
openOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
saveQuickSettingsBtn.addEventListener('click', saveQuickSettings);
testConnectionBtn.addEventListener('click', testConnection);
providerEl.addEventListener('change', suggestEndpointByProvider);

initQuickSettings().catch((error) => setStatus(error.message || 'Failed to load settings', true));

async function run(action) {
  setStatus('Processing...', false);
  setDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Active tab not found');

    const response = await chrome.runtime.sendMessage({
      type: 'AI_TRIGGER_ACTION',
      tabId: tab.id,
      action
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Failed to process text');
    }

    setStatus('Done ✅', false);
  } catch (error) {
    setStatus(error.message || 'Error', true);
  } finally {
    setDisabled(false);
  }
}

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', !!isError);
}

function setDisabled(value) {
  translateBtn.disabled = value;
  translateRuBtn.disabled = value;
  paraphraseBtn.disabled = value;
  testConnectionBtn.disabled = value;
}

async function initQuickSettings() {
  const data = await chrome.storage.sync.get(Object.keys(QUICK_DEFAULTS));
  const settings = { ...QUICK_DEFAULTS, ...data };
  providerEl.value = settings.provider;
  endpointEl.value = settings.endpoint;
  modelEl.value = settings.model;
  replaceSelectionEl.checked = !!settings.replaceSelection;
}

async function saveQuickSettings() {
  const payload = {
    provider: providerEl.value,
    endpoint: endpointEl.value.trim(),
    model: modelEl.value.trim(),
    replaceSelection: !!replaceSelectionEl.checked
  };

  if (!payload.endpoint) {
    setStatus('Endpoint is required', true);
    return;
  }

  if (!payload.model) {
    setStatus('Model is required', true);
    return;
  }

  await chrome.storage.sync.set(payload);
  setStatus('Settings saved ✅', false);
}

async function testConnection() {
  setStatus('Testing connection...', false);
  setDisabled(true);

  try {
    await saveQuickSettings();
    const response = await chrome.runtime.sendMessage({ type: 'AI_TEST_CONNECTION' });
    if (!response?.ok) {
      throw new Error(response?.error || 'Connection test failed');
    }
    setStatus(response.result || 'Connection successful ✅', false);
  } catch (error) {
    setStatus(error.message || 'Connection test error', true);
  } finally {
    setDisabled(false);
  }
}

function suggestEndpointByProvider() {
  const provider = providerEl.value;
  const endpoint = endpointEl.value.trim();

  if (provider === 'ollama-generate' && (!endpoint || endpoint.includes('/chat/completions'))) {
    endpointEl.value = 'http://10.20.30.3:11434/api/generate';
  }

  if (provider === 'openai-chat' && (!endpoint || endpoint.includes('/api/generate'))) {
    endpointEl.value = 'http://localhost:3000/api/chat/completions';
  }
}
