const frame = document.querySelector('#page-preview');
const slider = document.querySelector('#title-size');
const number = document.querySelector('#size-number');
const loading = document.querySelector('#loading');
const storageKey = 'kingdom-come-desktop-title-preview';
const titleNames = new Set(['家族档案', '家族谱系', '人物名册']);
let size = 56;
let currentDoc;
let observer;
let waiting = 0;
try {
  const saved = Number(localStorage.getItem(storageKey));
  if (saved >= 28 && saved <= 96) size = Math.round(saved);
} catch {}

function selectionText() {
  return `Kingdom Come 电脑端大标题统一字号：${size} px。仅应用于「家族档案」「家族谱系」「人物名册」，其他样式保持不变。`;
}

function updateSize(value) {
  if (!Number.isFinite(value)) return;
  size = Math.max(28, Math.min(96, Math.round(value)));
  slider.value = String(size);
  number.value = String(size);
  currentDoc?.documentElement.style.setProperty('--title-size-preview', `${size}px`);
  document.querySelector('#current-size').textContent = `当前预览：${size} px · 三个大标题同步`;
  document.querySelector('#copy-size').textContent = '复制选择';
  try { localStorage.setItem(storageKey, String(size)); } catch {}
}

function markTitles() {
  currentDoc.querySelectorAll('.opening-heading h1,.standard-page .page-heading h1').forEach(title => {
    if (titleNames.has(title.textContent.trim())) title.setAttribute('data-title-size-preview', '');
  });
}

function preparePage() {
  currentDoc = frame.contentDocument;
  if (!currentDoc?.querySelector('#root h1')) {
    if (waiting++ < 600) requestAnimationFrame(preparePage);
    else loading.textContent = '页面未能载入，请刷新重试。';
    return;
  }
  waiting = 0;
  if (!currentDoc.querySelector('#title-preview-style')) {
    const style = currentDoc.createElement('style');
    style.id = 'title-preview-style';
    style.textContent = '@media(min-width:801px){[data-title-size-preview]{font-size:var(--title-size-preview)!important}}';
    currentDoc.head.append(style);
  }
  observer?.disconnect();
  observer = new MutationObserver(markTitles);
  observer.observe(currentDoc.querySelector('#root'), {childList:true,subtree:true});
  markTitles();
  updateSize(size);
  loading.hidden = true;
}

frame.addEventListener('load', preparePage);
if (frame.contentDocument?.readyState === 'complete') preparePage();
slider.addEventListener('input', () => updateSize(Number(slider.value)));
number.addEventListener('input', () => {
  if (number.value !== '' && number.validity.valid) updateSize(Number(number.value));
});
number.addEventListener('change', () => updateSize(Number(number.value) || size));
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-page]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  waiting = 0;
  observer?.disconnect();
  loading.hidden = false;
  frame.src = button.dataset.page;
}));
document.querySelector('#copy-size').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(selectionText());
    document.querySelector('#copy-size').textContent = '已复制 ✓';
  } catch {
    const text = document.querySelector('#choice-text');
    text.value = selectionText();
    document.querySelector('#copy-dialog').showModal();
    text.focus(); text.select();
  }
});
document.querySelector('#close-dialog').addEventListener('click', () => document.querySelector('#copy-dialog').close());
updateSize(size);
