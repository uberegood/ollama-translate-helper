const DEFAULTS = {
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

const els = {
  provider: document.getElementById('provider'),
  endpoint: document.getElementById('endpoint'),
  model: document.getElementById('model'),
  apiKey: document.getElementById('apiKey'),
  replaceSelection: document.getElementById('replaceSelection'),
  translatePrompt: document.getElementById('translatePrompt'),
  translateRuPrompt: document.getElementById('translateRuPrompt'),
  paraphrasePrompt: document.getElementById('paraphrasePrompt'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  status: document.getElementById('status')
};

init().catch((error) => setStatus(error.message || 'Load error', true));

els.saveBtn.addEventListener('click', save);
els.resetBtn.addEventListener('click', resetDefaults);
els.provider.addEventListener('change', suggestEndpointByProvider);

async function init() {
  const data = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const settings = { ...DEFAULTS, ...data };
  fillForm(settings);
  setStatus('Settings loaded', false);
}

function fillForm(settings) {
  els.provider.value = settings.provider;
  els.endpoint.value = settings.endpoint;
  els.model.value = settings.model;
  els.apiKey.value = settings.apiKey;
  els.replaceSelection.checked = !!settings.replaceSelection;
  els.translatePrompt.value = settings.translatePrompt;
  els.translateRuPrompt.value = settings.translateRuPrompt;
  els.paraphrasePrompt.value = settings.paraphrasePrompt;
}

async function save() {
  const payload = {
    provider: els.provider.value,
    endpoint: els.endpoint.value.trim(),
    model: els.model.value.trim(),
    apiKey: els.apiKey.value.trim(),
    replaceSelection: !!els.replaceSelection.checked,
    translatePrompt: els.translatePrompt.value.trim(),
    translateRuPrompt: els.translateRuPrompt.value.trim(),
    paraphrasePrompt: els.paraphrasePrompt.value.trim()
  };

  if (!payload.endpoint) {
    setStatus('Endpoint URL is required', true);
    return;
  }
  if (!payload.model) {
    setStatus('Model is required', true);
    return;
  }
  if (!payload.translatePrompt || !payload.translateRuPrompt || !payload.paraphrasePrompt) {
    setStatus('Prompts must not be empty', true);
    return;
  }

  await chrome.storage.sync.set(payload);
  setStatus('Saved ✅', false);
}

async function resetDefaults() {
  await chrome.storage.sync.set(DEFAULTS);
  fillForm(DEFAULTS);
  setStatus('Reset to defaults', false);
}

function suggestEndpointByProvider() {
  const provider = els.provider.value;
  const endpoint = els.endpoint.value.trim();

  if (provider === 'ollama-generate' && (!endpoint || endpoint.includes('/chat/completions'))) {
    els.endpoint.value = 'http://10.20.30.3:11434/api/generate';
  }

  if (provider === 'openai-chat' && (!endpoint || endpoint.includes('/api/generate'))) {
    els.endpoint.value = 'http://localhost:3000/api/chat/completions';
  }
}

function setStatus(text, isError) {
  els.status.textContent = text;
  els.status.classList.toggle('error', !!isError);
}
