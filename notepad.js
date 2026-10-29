document.addEventListener('DOMContentLoaded', () => {
  // i18n dictionary, t(), and currentLang now come from the shared i18n.js
  // (loaded as a separate <script> before this file in notepad.html) —
  // this used to be a private duplicate dictionary with only en/fa; using
  // the shared one gives this standalone tab the same 7-language coverage
  // as the main widget, with no dictionary to keep in sync by hand.


  const els = {
    title: document.getElementById('title'),
    subtitle: document.getElementById('subtitle'),
    textarea: document.getElementById('note-text'),
    tokenMeter: document.getElementById('token-meter'),
    alignLeft: document.getElementById('align-left'),
    alignCenter: document.getElementById('align-center'),
    alignRight: document.getElementById('align-right'),
    fontDec: document.getElementById('font-dec'),
    fontInc: document.getElementById('font-inc'),
    fontLabel: document.getElementById('font-label'),
    clearBtn: document.getElementById('clear-btn'),
    copyBtn: document.getElementById('copy-btn'),
    saveBtn: document.getElementById('save-btn'),
    toast: document.getElementById('toast'),
    backBtn: document.getElementById('back-btn'),
    backLabel: document.getElementById('back-label'),
    promptsToggleBtn: document.getElementById('prompts-toggle-btn'),
    promptsToggleLabel: document.getElementById('prompts-toggle-label'),
    promptsPanel: document.getElementById('prompts-panel'),
    promptsBar: document.getElementById('prompts-bar'),
    promptsSearchInput: document.getElementById('prompts-search-input'),
    workNoteTabs: document.getElementById('work-note-tabs'),
    workNoteAdd: document.getElementById('work-note-add'),
    workNoteMore: document.getElementById('work-note-more'),
    workNoteMoreList: document.getElementById('work-note-more-list'),
    workNoteTodo: document.getElementById('work-note-todo'),
    emojiToggleBtn: document.getElementById('emoji-toggle-btn'),
    emojiPopover: document.getElementById('emoji-popover'),
    aiSelect: document.getElementById('ai-select'),
    sendBtn: document.getElementById('send-btn'),
    sendLabel: document.getElementById('send-label'),
    translateBtn: document.getElementById('translate-btn'),
    spellcheckBtn: document.getElementById('spellcheck-btn'),
    speakBtn: document.getElementById('speak-btn'),
    emojiOnlineBtn: document.getElementById('emoji-online-btn'),
    emojiOnlineModal: document.getElementById('emoji-online-modal'),
    emojiOnlineTitle: document.getElementById('emoji-online-title'),
    emojiOnlineClose: document.getElementById('emoji-online-close'),
    emojiOnlineSearch: document.getElementById('emoji-online-search'),
    emojiOnlineGrid: document.getElementById('emoji-online-grid'),
    tplModal: document.getElementById('tpl-modal'),
    tplModalTitle: document.getElementById('tpl-modal-title'),
    tplModalName: document.getElementById('tpl-modal-name'),
    tplModalBody: document.getElementById('tpl-modal-body'),
    tplModalDelete: document.getElementById('tpl-modal-delete'),
    tplModalCancel: document.getElementById('tpl-modal-cancel'),
    tplModalSave: document.getElementById('tpl-modal-save')
  };

  function applyTranslation() {
    document.body.className = isRTL(currentLang) ? 'rtl' : '';
    els.title.textContent = t('notepadPageTitle');
    els.subtitle.textContent = t('notepadPageSubtitle');
    els.clearBtn.textContent = t('notepadClearBtn');
    els.copyBtn.textContent = t('noteCopyBtn');
    els.saveBtn.textContent = t('notepadSaveBtn');
    els.backLabel.textContent = t('notepadBackBtn');
    els.promptsToggleLabel.textContent = t('notepadPromptsBtn');
    els.sendLabel.textContent = t('notepadSendBtn');
    if (els.translateBtn) {
      els.translateBtn.title = t('noteTranslateTitle');
      els.translateBtn.setAttribute('aria-label', t('noteTranslateTitle'));
    }
    if (typeof updateTranslateLangBadge === 'function') updateTranslateLangBadge();
    if (els.spellcheckBtn) {
      els.spellcheckBtn.title = t('noteSpellcheckTitle');
      els.spellcheckBtn.setAttribute('aria-label', t('noteSpellcheckTitle'));
    }
    if (els.speakBtn) {
      els.speakBtn.title = t('noteTtsTitle');
      els.speakBtn.setAttribute('aria-label', t('noteTtsTitle'));
    }
    if (els.emojiOnlineBtn) {
      els.emojiOnlineBtn.title = t('emojiOnlineBtn');
      els.emojiOnlineBtn.setAttribute('aria-label', t('emojiOnlineBtn'));
    }
    if (els.emojiOnlineTitle) els.emojiOnlineTitle.textContent = t('emojiOnlineTitle');
    if (els.emojiOnlineSearch) els.emojiOnlineSearch.placeholder = t('emojiOnlineSearch');
    if (els.promptsSearchInput) els.promptsSearchInput.placeholder = t('noteTplSearchPlaceholder');
    updateTokenMeter();
    renderPrompts();
    if (typeof renderWorkNotes === 'function') renderWorkNotes();
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function estimateTokens(text) {
    if (!text) return 0;
    const chars = text.length;
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words * 1.35 + chars * 0.08));
  }

  function updateTokenMeter() {
    const text = els.textarea.value;
    if (!text.trim()) { els.tokenMeter.textContent = t('noteTokenEmpty'); return; }
    els.tokenMeter.textContent = t('noteTokenMeter')
      .replace('{chars}', String(text.length))
      .replace('{tokens}', String(estimateTokens(text)));
  }

  // ============================= Alignment / Font size =============================
  function setAlign(align, persist) {
    els.textarea.style.textAlign = align;
    [els.alignLeft, els.alignCenter, els.alignRight].forEach(b => b.classList.remove('active'));
    const btn = align === 'right' ? els.alignRight : align === 'center' ? els.alignCenter : els.alignLeft;
    if (btn) btn.classList.add('active');
    if (persist !== false) {
      try { chrome.storage.local.set({ noteTextAlign: align }); } catch (e) {}
    }
  }
  els.alignLeft.addEventListener('click', () => setAlign('left'));
  els.alignCenter.addEventListener('click', () => setAlign('center'));
  els.alignRight.addEventListener('click', () => setAlign('right'));

  const FONT_MIN = 11, FONT_MAX = 24, FONT_DEFAULT = 14;
  let fontSize = FONT_DEFAULT;
  function applyFontSize(size, persist) {
    fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(size)));
    els.textarea.style.fontSize = fontSize + 'px';
    els.fontLabel.textContent = String(fontSize);
    els.fontDec.disabled = fontSize <= FONT_MIN;
    els.fontInc.disabled = fontSize >= FONT_MAX;
    if (persist !== false) {
      try { chrome.storage.local.set({ noteFontSize: fontSize }); } catch (e) {}
    }
  }
  els.fontInc.addEventListener('click', () => applyFontSize(fontSize + 1));
  els.fontDec.addEventListener('click', () => applyFontSize(fontSize - 1));

  // ============================= Draft text sync =============================
  let draftSaveTimer = null;
  const WORK_NOTES_KEY = 'aiWorkNotes';
  const WORK_NOTE_COLORS = ['amber', 'cyan', 'rose', 'violet', 'mint'];
  let workNotes = [];
  let activeWorkNoteId = new URLSearchParams(location.search).get('workNote') || null;
  let scratchDraftCache = null;
  let todoSyncTimer = null;

  function workNoteLabel(key) {
    const labels = {
      draft: { fa: 'پیش‌نویس', en: 'Draft', ar: 'مسودة', es: 'Borrador', de: 'Entwurf', fr: 'Brouillon', ja: '下書き', ru: 'Черновик' },
      add: { fa: 'یادداشت تازه', en: 'New note', ar: 'ملاحظة جديدة', es: 'Nueva nota', de: 'Neue Notiz', fr: 'Nouvelle note', ja: '新しいメモ', ru: 'Новая заметка' },
      more: { fa: 'بیشتر', en: 'More', ar: 'المزيد', es: 'Más', de: 'Mehr', fr: 'Plus', ja: 'もっと', ru: 'Ещё' },
      delete: { fa: 'حذف یادداشت', en: 'Delete note', ar: 'حذف الملاحظة', es: 'Eliminar nota', de: 'Notiz löschen', fr: 'Supprimer la note', ja: 'メモを削除', ru: 'Удалить заметку' },
      confirm: { fa: 'این یادداشت و کار متصل به آن در Todo حذف شوند؟', en: 'Delete this note and its linked Todo item?', ar: 'هل تريد حذف هذه الملاحظة ومهمة Todo المرتبطة بها؟', es: '¿Eliminar esta nota y su tarea vinculada?', de: 'Diese Notiz und die verknüpfte Todo-Aufgabe löschen?', fr: 'Supprimer cette note et la tâche Todo liée ?', ja: 'このメモとリンクされたTodo項目を削除しますか？', ru: 'Удалить заметку и связанную задачу Todo?' },
      todo: { fa: 'افزودن به کارها', en: 'Add to Todo', ar: 'إضافة إلى المهام', es: 'Añadir a tareas', de: 'Zu Aufgaben', fr: 'Ajouter aux tâches', ja: 'Todoに追加', ru: 'Добавить в задачи' },
      todoShort: { fa: '＋ کارها', en: '＋ Todo', ar: '＋ مهام', es: '＋ Tareas', de: '＋ Todo', fr: '＋ Tâches', ja: '＋ Todo', ru: '＋ Задачи' },
      todoLinkedShort: { fa: '✓ کارها', en: '✓ Todo', ar: '✓ مهام', es: '✓ Tareas', de: '✓ Todo', fr: '✓ Tâches', ja: '✓ Todo', ru: '✓ Задачи' },
      todoLinked: { fa: 'در فهرست کارها', en: 'Already in Todo', ar: 'موجود في المهام', es: 'Ya está en tareas', de: 'Bereits in Aufgaben', fr: 'Déjà dans les tâches', ja: 'Todoに追加済み', ru: 'Уже в задачах' },
      todoAdded: { fa: 'یادداشت به کارهای روزانه وصل شد', en: 'Note added to daily Todo', ar: 'أضيفت الملاحظة إلى المهام اليومية', es: 'Nota añadida a tareas diarias', de: 'Notiz zu täglichen Aufgaben hinzugefügt', fr: 'Note ajoutée aux tâches du jour', ja: 'メモを今日のTodoに追加しました', ru: 'Заметка добавлена в задачи на сегодня' }
    };
    return labels[key] && labels[key][currentLang] !== undefined ? labels[key][currentLang] : labels[key].en;
  }
  function makeWorkNoteId() { return 'wn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function normalizeWorkNotes(items) {
    return (Array.isArray(items) ? items : []).filter(n => n && typeof n.text === 'string').map((n, i) => ({
      id: String(n.id || makeWorkNoteId()), text: n.text,
      color: WORK_NOTE_COLORS.includes(n.color) ? n.color : WORK_NOTE_COLORS[i % WORK_NOTE_COLORS.length],
      createdAt: Number(n.createdAt) || Date.now(), updatedAt: Number(n.updatedAt) || Number(n.createdAt) || Date.now(),
      todoId: n.todoId ? String(n.todoId) : null
    }));
  }
  function activeWorkNote() { return activeWorkNoteId ? workNotes.find(n => n.id === activeWorkNoteId) || null : null; }
  function workNoteTitle(note, index) {
    const first = String(note.text || '').split(/\r?\n/).map(s => s.trim()).find(Boolean);
    return (first || (currentLang === 'fa' ? 'یادداشت' : 'Work note') + ' ' + (index + 1)).slice(0, 20);
  }
  function persistWorkNotes() { try { chrome.storage.local.set({ [WORK_NOTES_KEY]: workNotes }); } catch (e) {} }
  function renderWorkNotes() {
    if (!els.workNoteTabs) return;
    const tabs = els.workNoteTabs; tabs.innerHTML = '';
    const draft = document.createElement('button'); draft.type = 'button'; draft.className = 'work-note-tab work-note-draft' + (!activeWorkNoteId ? ' is-active' : '');
    draft.textContent = workNoteLabel('draft'); draft.setAttribute('role', 'tab'); draft.setAttribute('aria-selected', String(!activeWorkNoteId));
    draft.addEventListener('click', () => selectWorkNote(null)); tabs.appendChild(draft);
    const sorted = workNotes.slice().sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    sorted.slice(0, 5).forEach((note, index) => {
      const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'work-note-tab work-note-paper' + (activeWorkNoteId === note.id ? ' is-active' : '');
      tab.dataset.color = note.color; tab.textContent = workNoteTitle(note, index); tab.title = note.text || workNoteTitle(note, index);
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(activeWorkNoteId === note.id));
      tab.addEventListener('click', () => selectWorkNote(note.id)); tabs.appendChild(tab);
    });
    if (els.workNoteAdd) { els.workNoteAdd.title = workNoteLabel('add'); els.workNoteAdd.setAttribute('aria-label', workNoteLabel('add')); }
    if (els.workNoteMore) {
      els.workNoteMore.hidden = workNotes.length === 0; els.workNoteMore.textContent = workNoteLabel('more');
      els.workNoteMore.title = workNoteLabel('more'); els.workNoteMore.setAttribute('aria-label', workNoteLabel('more'));
    }
    if (els.workNoteMoreList) {
      const list = els.workNoteMoreList; list.innerHTML = '';
      sorted.forEach((note, index) => {
        const row = document.createElement('div'); row.className = 'work-note-more-row';
        const open = document.createElement('button'); open.type = 'button'; open.className = 'work-note-more-open'; open.dataset.color = note.color;
        open.textContent = workNoteTitle(note, index); open.title = note.text || open.textContent; open.addEventListener('click', () => selectWorkNote(note.id));
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'work-note-more-delete'; remove.textContent = '×'; remove.title = workNoteLabel('delete');
        remove.addEventListener('click', (event) => {
          event.stopPropagation(); if (!window.confirm(workNoteLabel('confirm'))) return;
          if (activeWorkNoteId === note.id) { flushCurrentNote(); clearTimeout(todoSyncTimer); activeWorkNoteId = null; els.textarea.value = scratchDraftCache || ''; }
          chrome.storage.local.get(['aiTreeTodos'], local => chrome.storage.sync.get(['aiTreeTodos'], sync => {
            const todos = Array.isArray(local.aiTreeTodos) ? local.aiTreeTodos : (Array.isArray(sync.aiTreeTodos) ? sync.aiTreeTodos : []);
            const remaining = todos.filter(td => td.sourceWorkNoteId !== note.id && (!note.todoId || td.id !== note.todoId));
            if (remaining.length !== todos.length) {
              chrome.storage.local.set({ aiTreeTodos: remaining });
              chrome.storage.sync.set({ aiTreeTodos: remaining });
              try { window.__aiTreeTodosForVoid = remaining; window.dispatchEvent(new CustomEvent('ai-tree-todos-updated', { detail: remaining })); } catch (e) {}
            }
          }));
          workNotes = workNotes.filter(n => n.id !== note.id); persistWorkNotes(); renderWorkNotes(); updateTokenMeter();
        });
        row.append(open, remove); list.appendChild(row);
      });
    }
    if (els.workNoteTodo) {
      const note = activeWorkNote();
      const linked = !!(note && note.todoId);
      els.workNoteTodo.textContent = linked ? workNoteLabel('todoLinkedShort') : workNoteLabel('todoShort');
      els.workNoteTodo.title = linked ? workNoteLabel('todoLinked') : workNoteLabel('todo');
    }
  }
  function saveWorkNoteText(id, text) {
    const note = workNotes.find(n => n.id === id); if (!note) return;
    note.text = String(text || ''); note.updatedAt = Date.now(); persistWorkNotes(); renderWorkNotes();
    if (note.todoId) {
      clearTimeout(todoSyncTimer);
      todoSyncTimer = setTimeout(() => {
        const taskText = note.text.trim(); if (!taskText) return;
        chrome.storage.local.get(['aiTreeTodos'], local => chrome.storage.sync.get(['aiTreeTodos'], sync => {
          const todos = Array.isArray(local.aiTreeTodos) ? local.aiTreeTodos : (Array.isArray(sync.aiTreeTodos) ? sync.aiTreeTodos : []);
          const task = todos.find(td => td.sourceWorkNoteId === note.id || td.id === note.todoId);
          if (task && task.text !== taskText) { task.text = taskText; chrome.storage.local.set({ aiTreeTodos: todos }); chrome.storage.sync.set({ aiTreeTodos: todos }); }
        }));
      }, 1200);
    }
  }
  function flushCurrentNote() {
    clearTimeout(draftSaveTimer);
    if (activeWorkNoteId) saveWorkNoteText(activeWorkNoteId, els.textarea.value);
    else { scratchDraftCache = els.textarea.value; try { chrome.storage.local.set({ savedPromptDraft: scratchDraftCache }); } catch (e) {} }
  }
  function selectWorkNote(id) {
    if (id === activeWorkNoteId) return;
    flushCurrentNote(); activeWorkNoteId = id || null;
    if (els.workNoteMoreList) els.workNoteMoreList.hidden = true;
    if (activeWorkNoteId) {
      const note = activeWorkNote(); if (!note) { activeWorkNoteId = null; return; }
      els.textarea.value = note.text; renderWorkNotes(); updateTokenMeter(); return;
    }
    renderWorkNotes();
    if (scratchDraftCache !== null) { els.textarea.value = scratchDraftCache; updateTokenMeter(); return; }
    chrome.storage.local.get(['savedPromptDraft'], data => { if (!activeWorkNoteId) { scratchDraftCache = data.savedPromptDraft || ''; els.textarea.value = scratchDraftCache; updateTokenMeter(); } });
  }
  function addWorkNote() {
    flushCurrentNote();
    const note = { id: makeWorkNoteId(), text: '', color: WORK_NOTE_COLORS[workNotes.length % WORK_NOTE_COLORS.length], createdAt: Date.now(), updatedAt: Date.now(), todoId: null };
    workNotes.unshift(note); activeWorkNoteId = note.id; persistWorkNotes(); renderWorkNotes();
    els.textarea.value = ''; updateTokenMeter(); els.textarea.focus();
  }
  function addCurrentNoteToTodo() {
    const text = String(els.textarea.value || '').trim();
    if (!text) { showToast(currentLang === 'fa' ? 'ابتدا متن یادداشت را بنویسید' : 'Write a note first'); return; }
    let note = activeWorkNote();
    if (!note) {
      flushCurrentNote(); note = { id: makeWorkNoteId(), text, color: WORK_NOTE_COLORS[workNotes.length % WORK_NOTE_COLORS.length], createdAt: Date.now(), updatedAt: Date.now(), todoId: null };
      workNotes.unshift(note); activeWorkNoteId = note.id; persistWorkNotes(); renderWorkNotes();
    } else { note.text = text; note.updatedAt = Date.now(); }
    chrome.storage.local.get(['aiTreeTodos'], local => chrome.storage.sync.get(['aiTreeTodos'], sync => {
      const todos = Array.isArray(local.aiTreeTodos) ? local.aiTreeTodos : (Array.isArray(sync.aiTreeTodos) ? sync.aiTreeTodos : []);
      let task = todos.find(td => td.sourceWorkNoteId === note.id || td.id === note.todoId);
      if (task) task.text = text;
      else { task = { id: 'td_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, done: false, type: 'daily', createdAt: Date.now(), sourceWorkNoteId: note.id }; todos.push(task); }
      note.todoId = task.id; persistWorkNotes();
      chrome.storage.local.set({ aiTreeTodos: todos }); chrome.storage.sync.set({ aiTreeTodos: todos });
      try { window.__aiTreeTodosForVoid = todos; window.dispatchEvent(new CustomEvent('ai-tree-todos-updated', { detail: todos })); } catch (e) {}
      renderWorkNotes(); showToast(workNoteLabel('todoAdded'));
    }));
  }
  if (els.workNoteAdd) els.workNoteAdd.addEventListener('click', addWorkNote);
  if (els.workNoteMore && els.workNoteMoreList) els.workNoteMore.addEventListener('click', () => { els.workNoteMoreList.hidden = !els.workNoteMoreList.hidden; });
  if (els.workNoteTodo) els.workNoteTodo.addEventListener('click', addCurrentNoteToTodo);

  function saveDraftDebounced() {
    clearTimeout(draftSaveTimer);
    const noteId = activeWorkNoteId;
    const value = els.textarea.value;
    draftSaveTimer = setTimeout(() => {
      if (noteId) saveWorkNoteText(noteId, value);
      else { scratchDraftCache = value; try { chrome.storage.local.set({ savedPromptDraft: value }); } catch (e) {} }
    }, 400);
  }
  els.textarea.addEventListener('input', () => {
    updateTokenMeter();
    saveDraftDebounced();
    harvestTypedEmoji();
  });

  els.clearBtn.addEventListener('click', () => {
    if (!els.textarea.value.trim()) return;
    els.textarea.value = '';
    updateTokenMeter();
    if (activeWorkNoteId) saveWorkNoteText(activeWorkNoteId, '');
    else { scratchDraftCache = ''; try { chrome.storage.local.set({ savedPromptDraft: '' }); } catch (e) {} }
    showToast(t('notepadToastCleared'));
  });

  els.copyBtn.addEventListener('click', () => {
    const text = els.textarea.value;
    if (!text.trim()) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(t('toastCopied'))).catch(() => {});
    }
  });

  els.saveBtn.addEventListener('click', () => {
    const text = els.textarea.value;
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AI_Note_' + Date.now() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('toastDownloaded'));
  });

  // ============================= Prompts (built-in + custom) =============================
  const BUILTIN_PROMPTS = [
    { id: 'builtin-refactor', title: 'Code Review', text: 'Act as a Principal Software Architect. Review the following code for efficiency, security, and edge-case resilience:\n\n', builtIn: true },
    { id: 'builtin-summary', title: 'Summarize', text: 'Analyze the text below and provide a structured comparative table and bullet-point executive summary:\n\n', builtIn: true },
    { id: 'builtin-critic', title: 'Critique', text: 'Critique the following thesis from first principles. Identify logical fallacies and hidden assumptions:\n\n', builtIn: true },
    { id: 'builtin-translate', title: 'Translate', text: 'Translate the following text into clear, natural English while preserving technical meaning:\n\n', builtIn: true },
    { id: 'builtin-song', title: 'Songwriter', text: 'Turn the following text into a beautiful song.\nThe song must not be a mere rewrite of the text; it should transform its feeling, meaning, and imagery into a musical work.\nUse rhyme and flowing words, and write the lyrics so a listener can easily remember them.\n\nText:\n', builtIn: true },
    { id: 'builtin-logo', title: 'Logo Maker', text: 'Act as an elite brand designer. Create a logo for [brand name] that captures [core value] and speaks directly to [audience]. Make it sophisticated, timeless, and instantly recognizable.\n\n', builtIn: true }
  ];
  const CUSTOM_PROMPT_MAX = 12;
  const CUSTOM_PROMPT_KEY = 'aiTreeCustomPrompts';
  const PROMPT_OVERRIDE_KEY = 'aiTreePromptOverrides';
  const PROMPT_HIDDEN_KEY = 'aiTreePromptHidden';
  let customPrompts = [];
  let promptOverrides = {};
  let promptHiddenIds = [];
  let tplEditMode = false;
  let tplEditingId = null;
  let tplEditingBuiltIn = false;
  let promptSearchQuery = ''; // جستجوی فازیِ زنده روی عنوان/متن پرامپت‌ها

  // همان تطبیق فازیِ سبک (زیررشته‌ایِ ترتیب‌دار) که در ویجت اصلی هم استفاده شده —
  // بدون هیچ وابستگی خارجی، روی فارسی/عربی/انگلیسی یکسان کار می‌کند.
  function fuzzyPromptMatch(query, text) {
    if (!query) return true;
    if (!text) return false;
    query = query.toLowerCase();
    text = text.toLowerCase();
    let qi = 0;
    for (let i = 0; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) qi++;
    }
    return qi === query.length;
  }

  function allPrompts() {
    const hidden = new Set(promptHiddenIds || []);
    const builtins = BUILTIN_PROMPTS.filter(p => !hidden.has(p.id)).map(p => {
      const ov = promptOverrides && promptOverrides[p.id];
      if (ov && (ov.title || ov.text)) {
        return { ...p, title: (ov.title != null ? String(ov.title) : p.title).slice(0, 40), text: ov.text != null ? String(ov.text) : p.text, overridden: true };
      }
      return { ...p, overridden: false };
    });
    return builtins.concat(customPrompts.map(p => ({ ...p, builtIn: false, overridden: false })));
  }

  function insertTemplate(text) {
    const start = els.textarea.selectionStart || 0;
    const end = els.textarea.selectionEnd || 0;
    const cur = els.textarea.value;
    els.textarea.value = cur.slice(0, start) + text + cur.slice(end);
    const pos = start + text.length;
    els.textarea.setSelectionRange(pos, pos);
    els.textarea.focus();
    updateTokenMeter();
    saveDraftDebounced();
  }

  function saveCustomPrompts() { try { chrome.storage.local.set({ [CUSTOM_PROMPT_KEY]: customPrompts }); } catch (e) {} }
  function savePromptOverrides() { try { chrome.storage.local.set({ [PROMPT_OVERRIDE_KEY]: promptOverrides }); } catch (e) {} }
  function savePromptHidden() { try { chrome.storage.local.set({ [PROMPT_HIDDEN_KEY]: promptHiddenIds }); } catch (e) {} }

  function renderPrompts() {
    els.promptsBar.innerHTML = '';
    const matched = allPrompts().filter(tpl => fuzzyPromptMatch(promptSearchQuery, tpl.title) || fuzzyPromptMatch(promptSearchQuery, tpl.text));
    if (promptSearchQuery && !matched.length) {
      const empty = document.createElement('span');
      empty.className = 'prompts-empty';
      empty.dir = 'auto';
      empty.textContent = t('noteTplSearchEmpty');
      els.promptsBar.appendChild(empty);
    }
    matched.forEach((tpl) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tpl-chip' + (tpl.builtIn ? '' : ' is-custom') + (tpl.overridden ? ' is-overridden' : '') + (tplEditMode ? ' is-editable' : '');
      chip.dir = 'auto';
      chip.textContent = tpl.title;
      chip.title = tpl.title;
      chip.addEventListener('click', () => {
        if (tplEditMode) { openTplModal(tpl); return; }
        insertTemplate(tpl.text);
      });
      els.promptsBar.appendChild(chip);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tpl-action';
    addBtn.textContent = '+';
    addBtn.title = t('noteTplAdd');
    addBtn.addEventListener('click', () => {
      if (customPrompts.length >= CUSTOM_PROMPT_MAX) { showToast(t('noteTplToastLimit')); return; }
      openTplModal(null);
    });
    els.promptsBar.appendChild(addBtn);
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'tpl-action' + (tplEditMode ? ' is-active' : '');
    editBtn.textContent = tplEditMode ? '✓' : '✎';
    editBtn.title = tplEditMode ? t('noteTplDone') : t('noteTplEdit');
    editBtn.addEventListener('click', () => { tplEditMode = !tplEditMode; renderPrompts(); });
    els.promptsBar.appendChild(editBtn);
  }

  function openTplModal(promptOrNull) {
    tplEditingId = promptOrNull ? promptOrNull.id : null;
    tplEditingBuiltIn = !!(promptOrNull && promptOrNull.builtIn);
    els.tplModalTitle.textContent = promptOrNull ? t('noteTplFormTitleEdit') : t('noteTplFormTitleNew');
    els.tplModalName.placeholder = t('noteTplFormName');
    els.tplModalBody.placeholder = t('noteTplFormBody');
    els.tplModalName.value = promptOrNull ? (promptOrNull.title || '') : '';
    els.tplModalBody.value = promptOrNull ? (promptOrNull.text || '') : '';
    els.tplModalDelete.style.display = promptOrNull ? '' : 'none';
    els.tplModal.classList.add('open');
    els.tplModalName.focus();
  }
  function closeTplModal() { els.tplModal.classList.remove('open'); tplEditingId = null; tplEditingBuiltIn = false; }
  els.tplModalCancel.addEventListener('click', closeTplModal);
  els.tplModal.addEventListener('click', (e) => { if (e.target === els.tplModal) closeTplModal(); });
  els.tplModalSave.addEventListener('click', () => {
    const title = (els.tplModalName.value || '').trim().slice(0, 40);
    const body = (els.tplModalBody.value || '').trim();
    if (!title || !body) { showToast(t('noteTplToastNeedFields')); return; }
    if (tplEditingId && tplEditingBuiltIn) {
      promptOverrides[tplEditingId] = { title, text: body };
      savePromptOverrides();
    } else if (tplEditingId) {
      const idx = customPrompts.findIndex(p => p.id === tplEditingId);
      if (idx >= 0) customPrompts[idx] = { ...customPrompts[idx], title, text: body };
      else customPrompts.push({ id: tplEditingId, title, text: body });
      saveCustomPrompts();
    } else {
      if (customPrompts.length >= CUSTOM_PROMPT_MAX) { showToast(t('noteTplToastLimit')); return; }
      customPrompts.push({ id: 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, text: body });
      saveCustomPrompts();
    }
    closeTplModal();
    renderPrompts();
    showToast(t('noteTplToastSaved'));
  });
  els.tplModalDelete.addEventListener('click', () => {
    if (!tplEditingId) return;
    if (tplEditingBuiltIn) {
      if (!promptHiddenIds.includes(tplEditingId)) { promptHiddenIds.push(tplEditingId); savePromptHidden(); }
      if (promptOverrides[tplEditingId]) { delete promptOverrides[tplEditingId]; savePromptOverrides(); }
    } else {
      customPrompts = customPrompts.filter(p => p.id !== tplEditingId);
      saveCustomPrompts();
    }
    closeTplModal();
    renderPrompts();
    showToast(t('noteTplToastDeleted'));
  });

  els.promptsToggleBtn.addEventListener('click', () => {
    els.promptsPanel.classList.toggle('open');
    els.promptsToggleBtn.classList.toggle('active', els.promptsPanel.classList.contains('open'));
  });

  if (els.promptsSearchInput) {
    els.promptsSearchInput.addEventListener('input', () => {
      promptSearchQuery = els.promptsSearchInput.value.trim();
      renderPrompts();
    });
  }

  // ============================= Emoji =============================
  const DEFAULT_FAVORITE_EMOJIS = ['✨', '📌', '🔥', '💡', '🌱', '🎯', '🚀', '⭐'];
  const EMOJI_PICKER_GRID = [
    '😀','😊','🥰','😎','🤔','😂','🙌','👏',
    '✨','🔥','💡','📌','✅','❌','⚠️','💬',
    '🌱','🎯','🚀','⭐','❤️','💙','💜','🖤',
    '📝','📚','🧠','⚡','🛠️','🎨','🎵','☕'
  ];
  let favoriteEmojis = DEFAULT_FAVORITE_EMOJIS.slice();
  const EMOJI_CHAR_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  let lastValueForEmoji = '';

  function saveEmojiMemory() { try { chrome.storage.local.set({ aiTreeEmojiMemory: favoriteEmojis }); } catch (e) {} }
  function pushEmojiToMemory(emoji) {
    if (!emoji) return;
    favoriteEmojis = [emoji, ...favoriteEmojis.filter(e => e !== emoji)].slice(0, 10);
    saveEmojiMemory();
  }
  function insertEmojiAtCursor(emoji) {
    const start = els.textarea.selectionStart || 0;
    const end = els.textarea.selectionEnd || 0;
    const val = els.textarea.value;
    els.textarea.value = val.slice(0, start) + emoji + val.slice(end);
    const pos = start + [...emoji].length;
    els.textarea.setSelectionRange(pos, pos);
    els.textarea.focus();
    updateTokenMeter();
    saveDraftDebounced();
    pushEmojiToMemory(emoji);
    renderEmojiPopover();
  }
  function harvestTypedEmoji() {
    const next = els.textarea.value;
    if (next.length > lastValueForEmoji.length) {
      const added = next.slice(lastValueForEmoji.length);
      const m = added.match(EMOJI_CHAR_RE);
      if (m) pushEmojiToMemory(m[0]);
    }
    lastValueForEmoji = next;
  }
  function renderEmojiPopover() {
    els.emojiPopover.innerHTML = '';
    if (!favoriteEmojis.length) favoriteEmojis = DEFAULT_FAVORITE_EMOJIS.slice();
    function addGrid(title, list) {
      if (!list.length) return;
      const h = document.createElement('div');
      h.className = 'emoji-popover-title';
      h.textContent = title;
      els.emojiPopover.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'emoji-grid';
      list.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-item';
        btn.textContent = emoji;
        btn.addEventListener('click', () => insertEmojiAtCursor(emoji));
        grid.appendChild(btn);
      });
      els.emojiPopover.appendChild(grid);
    }
    addGrid(t('emojiTrayTitle'), favoriteEmojis.slice());
    const seen = new Set(favoriteEmojis);
    addGrid(t('emojiMoreTitle'), EMOJI_PICKER_GRID.filter(e => !seen.has(e)));
  }
  els.emojiToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = els.emojiPopover.classList.toggle('open');
    if (open) renderEmojiPopover();
  });
  document.addEventListener('click', (e) => {
    if (els.emojiPopover.classList.contains('open') && !e.target.closest('.emoji-btn')) {
      els.emojiPopover.classList.remove('open');
    }
  });

  // ============================= Translate (background SW) =============================
  let translateBusy = false;

  // --- انتخاب صریح زبان مقصد ترجمه — همان کلید ذخیره‌سازی (translateTargetLang)
  // که در content.js (ویجت شناور) استفاده می‌شود، پس انتخاب کاربر بین این
  // صفحه و ویجت هم‌زمان و یکسان می‌ماند. چون این المان‌ها در notepad.html
  // وجود ندارند، اینجا به‌صورت پویا (JS) ساخته و کنار دکمهٔ ترجمه تزریق
  // می‌شوند — دقیقاً همان الگویی که notepad-voice-init.js برای بنر مجوز
  // میکروفون استفاده می‌کند (استایل inline، بدون وابستگی به CSS varهای صفحه).
  const TRANSLATE_LANGS = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'fa', label: 'فارسی', short: 'FA' },
    { code: 'ar', label: 'العربية', short: 'AR' },
    { code: 'es', label: 'Español', short: 'ES' },
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'ja', label: '日本語', short: 'JA' },
    { code: 'ru', label: 'Русский', short: 'RU' },
    { code: 'tr', label: 'Türkçe', short: 'TR' },
    { code: 'zh-Hans', label: '简体中文', short: '简' },
    { code: 'zh-Hant', label: '繁體中文', short: '繁' },
    { code: 'pt-BR', label: 'Português', short: 'PT' }
  ];

  function defaultTranslateTargetLang() {
    return currentLang === 'en' ? 'fa' : 'en';
  }
  let translateTargetLang = defaultTranslateTargetLang();

  let translateLangBtnEl = null;
  let translateLangPopoverEl = null;

  function updateTranslateLangBadge() {
    if (!translateLangBtnEl) return;
    const entry = TRANSLATE_LANGS.find((l) => l.code === translateTargetLang);
    translateLangBtnEl.textContent = entry ? entry.short : String(translateTargetLang).toUpperCase();
    const label = entry ? entry.label : translateTargetLang;
    const titleText = (t('translateTargetLabel') || 'Translate to') + ': ' + label;
    translateLangBtnEl.title = titleText;
    translateLangBtnEl.setAttribute('aria-label', titleText);
  }

  function setTranslateTargetLang(code) {
    translateTargetLang = code;
    updateTranslateLangBadge();
    try { chrome.storage.local.set({ translateTargetLang: code }); } catch (e) {}
  }

  function closeTranslateLangPopover() {
    if (!translateLangPopoverEl) return;
    document.removeEventListener('mousedown', onTranslateLangOutsideClick, true);
    translateLangPopoverEl.remove();
    translateLangPopoverEl = null;
  }
  function onTranslateLangOutsideClick(e) {
    if (translateLangPopoverEl && !translateLangPopoverEl.contains(e.target) && e.target !== translateLangBtnEl) {
      closeTranslateLangPopover();
    }
  }
  function openTranslateLangPopover() {
    if (translateLangPopoverEl || !translateLangBtnEl) return;
    const pop = document.createElement('div');
    pop.setAttribute('role', 'menu');
    pop.style.cssText =
      'position:fixed;min-width:150px;max-height:260px;overflow-y:auto;' +
      'background:rgba(20,22,30,0.97);border:1px solid rgba(255,255,255,0.12);' +
      'border-radius:10px;padding:6px;z-index:99999;' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.5);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Vazirmatn","Segoe UI",sans-serif;' +
      'direction:' + (isRTL(currentLang) ? 'rtl' : 'ltr') + ';';
    pop.innerHTML = TRANSLATE_LANGS.map((l) => {
      const active = l.code === translateTargetLang;
      return '<button type="button" data-lang="' + l.code + '" style="' +
        'display:block;width:100%;text-align:inherit;background:' + (active ? 'rgba(16,185,129,0.28)' : 'none') + ';' +
        'border:none;color:' + (active ? '#fff' : '#E5E7EB') + ';font-weight:' + (active ? '700' : '400') + ';' +
        'padding:7px 10px;border-radius:8px;font-size:12.5px;font-family:inherit;cursor:pointer;">' +
        l.label + '</button>';
    }).join('');

    document.body.appendChild(pop);
    const rect = translateLangBtnEl.getBoundingClientRect();
    pop.style.top = (rect.bottom + 6) + 'px';
    const roomRight = window.innerWidth - rect.left;
    if (roomRight < 160) pop.style.left = (window.innerWidth - rect.right - 150) + 'px';
    else pop.style.left = rect.left + 'px';

    pop.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (!btn) return;
      setTranslateTargetLang(btn.getAttribute('data-lang'));
      closeTranslateLangPopover();
    });

    translateLangPopoverEl = pop;
    setTimeout(() => document.addEventListener('mousedown', onTranslateLangOutsideClick, true), 50);
  }

  function mountTranslateLangBtn() {
    if (!els.translateBtn || translateLangBtnEl) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'EN';
    btn.style.cssText =
      'min-width:30px;padding:0 6px;margin-inline-start:4px;height:28px;' +
      'font-size:10.5px;font-weight:700;letter-spacing:0.3px;' +
      'display:inline-flex;align-items:center;justify-content:center;' +
      'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);' +
      'border-radius:8px;color:#E5E7EB;cursor:pointer;font-family:inherit;';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (translateLangPopoverEl) closeTranslateLangPopover();
      else openTranslateLangPopover();
    });
    els.translateBtn.insertAdjacentElement('afterend', btn);
    translateLangBtnEl = btn;
    updateTranslateLangBadge();
  }

  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['translateTargetLang'], (res) => {
        if (res && res.translateTargetLang) {
          translateTargetLang = res.translateTargetLang;
          updateTranslateLangBadge();
        }
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.translateTargetLang) {
          translateTargetLang = changes.translateTargetLang.newValue || defaultTranslateTargetLang();
          updateTranslateLangBadge();
        }
      });
    }
  } catch (e) {}

  mountTranslateLangBtn();

  function requestTranslation(text, targetLang) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          reject(new Error('no_extension_runtime'));
          return;
        }
        chrome.runtime.sendMessage(
          { action: 'translateText', text: text, targetLang: targetLang },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'no_receiver'));
              return;
            }
            if (response && response.success && typeof response.text === 'string') resolve(response.text);
            else reject(new Error((response && response.error) || 'translate_failed'));
          }
        );
      } catch (err) { reject(err); }
    });
  }
  let translateCooldownUntil = 0;

  async function runTranslate() {
    if (translateBusy) return;
    if (Date.now() < translateCooldownUntil) {
      showToast(t('toastTranslateRateLimited'));
      return;
    }
    const textVal = (els.textarea.value || '').trim();
    if (!textVal) { showToast(t('dockEmptyPrompt')); return; }
    if (textVal.length > 4500) { showToast(t('toastTranslateTooLong')); return; }
    const targetLang = translateTargetLang;
    translateBusy = true;
    if (els.translateBtn) {
      els.translateBtn.classList.add('is-busy');
      els.translateBtn.disabled = true;
    }
    showToast(t('toastTranslateBusy'));
    try {
      const translated = await requestTranslation(textVal, targetLang);
      els.textarea.value = translated;
      try {
        const end = els.textarea.value.length;
        els.textarea.setSelectionRange(end, end);
        els.textarea.focus();
      } catch (e) {}
      updateTokenMeter();
      saveDraftDebounced();
      showToast(t('toastTranslated'));
    } catch (err) {
      console.warn('[notepad] translate failed:', err);
      const errMsg = (err && err.message) || '';
      let toastMsg;
      if (/rate_limited/.test(errMsg)) {
        toastMsg = t('toastTranslateRateLimited');
        translateCooldownUntil = Date.now() + 4000;
      } else if (/network_offline/.test(errMsg)) toastMsg = t('toastTranslateOffline');
      else if (/network_error/.test(errMsg)) toastMsg = t('toastTranslateNetworkError');
      else toastMsg = t('toastTranslateFail');
      showToast(toastMsg);
    } finally {
      translateBusy = false;
      if (els.translateBtn) {
        els.translateBtn.classList.remove('is-busy');
        els.translateBtn.disabled = false;
      }
    }
  }
  if (els.translateBtn) {
    els.translateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runTranslate();
    });
  }

  // ============================= خواندن با صدا (Web Speech API — رایگان و آفلاین) =============================
  function detectSpeechLang(text) {
    // Persian and Arabic share the same Unicode block, so script alone can't
    // tell them apart — Persian-exclusive letters (پ چ ژ گ) disambiguate when
    // present; otherwise fall back to the current app language as a tiebreaker.
    const faOnly = (text.match(/[پچژگ]/g) || []).length;
    const arabicScript = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const la = (text.match(/[A-Za-z]/g) || []).length;
    if (arabicScript > la) {
      if (faOnly > 0) return 'fa-IR';
      return currentLang === 'fa' ? 'fa-IR' : 'ar-SA';
    }
    return 'en-US';
  }
  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (els.speakBtn) { els.speakBtn.classList.remove('is-speaking'); els.speakBtn.title = t('noteTtsTitle'); }
  }
  function runSpeak() {
    if (!('speechSynthesis' in window)) { showToast(t('toastTtsUnsupported')); return; }
    // اگر همین الان در حال خواندن است، دکمه به‌عنوان توقف عمل کند
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      stopSpeaking();
      showToast(t('toastTtsStopped'));
      return;
    }
    const textVal = (els.textarea.value || '').trim();
    if (!textVal) { showToast(t('dockEmptyPrompt')); return; }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textVal);
    utterance.lang = detectSpeechLang(textVal);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang === utterance.lang)
      || voices.find(v => v.lang && v.lang.startsWith(utterance.lang.slice(0, 2)))
      || voices.find(v => v.name.includes('Google US English'));
    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onend = () => stopSpeaking();
    utterance.onerror = () => stopSpeaking();

    if (els.speakBtn) { els.speakBtn.classList.add('is-speaking'); els.speakBtn.title = t('noteTtsStopTitle'); }
    window.speechSynthesis.speak(utterance);
  }
  if (els.speakBtn) {
    els.speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runSpeak();
    });
  }

  // ============================= Hybrid spell-check (FA offline / EN online) =============================
  let spellcheckBusy = false;

  function normalizePersianText(raw) {
    if (!raw) return raw;
    let fixed = raw;
    const zwnj = '\u200C';
    fixed = fixed.replace(/\u064A/g, '\u06CC').replace(/\u0643/g, '\u06A9');
    fixed = fixed.replace(/\b(ن?می)\s+(?=[\u0600-\u06FF])/g, '$1' + zwnj);
    fixed = fixed.replace(
      /(?<=[\u0600-\u06FF])\s+(ها|های|هایی|تر|ترین|ام|ات|اش|مان|تان|شان|ای|ایم|اید|اند)\b/g,
      zwnj + '$1'
    );
    fixed = fixed.replace(/\s+([،؛:?.!])/g, '$1');
    fixed = fixed.replace(/([،؛:?.!])(?=[\u0600-\u06FFa-zA-Z])/g, '$1 ');
    fixed = fixed.replace(/[^\S\n]{2,}/g, ' ');
    return fixed.trim();
  }

  function requestSpellcheck(text, lang) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'checkSpelling', text: text, lang: lang },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'no_receiver'));
              return;
            }
            if (response && response.success && Array.isArray(response.matches)) resolve(response.matches);
            else reject(new Error((response && response.error) || 'spellcheck_failed'));
          }
        );
      } catch (err) { reject(err); }
    });
  }

  function applySpellcheckCorrections(originalText, matches) {
    if (!matches || !matches.length) return { text: originalText, count: 0 };
    const sorted = matches.slice().sort((a, b) => (b.offset || 0) - (a.offset || 0));
    let corrected = originalText;
    let count = 0;
    sorted.forEach((match) => {
      if (!match || !match.replacements || !match.replacements.length) return;
      const best = match.replacements[0] && match.replacements[0].value;
      if (best == null) return;
      const start = match.offset | 0;
      const length = match.length | 0;
      if (start < 0 || length <= 0 || start + length > corrected.length) return;
      corrected = corrected.slice(0, start) + best + corrected.slice(start + length);
      count++;
    });
    return { text: corrected, count };
  }

  async function runSpellcheck() {
    if (spellcheckBusy) return;
    const textVal = els.textarea.value || '';
    if (!textVal.trim()) { showToast(t('dockEmptyPrompt')); return; }

    const isPersian = /[\u0600-\u06FF]/.test(textVal);

    // Offline Persian normalizer
    if (isPersian) {
      const cleaned = normalizePersianText(textVal);
      if (cleaned === textVal) {
        showToast(t('toastSpellcheckFaClean'));
        return;
      }
      els.textarea.value = cleaned;
      try {
        const end = els.textarea.value.length;
        els.textarea.setSelectionRange(end, end);
        els.textarea.focus();
      } catch (e) {}
      updateTokenMeter();
      saveDraftDebounced();
      showToast(t('toastSpellcheckFaFixed'));
      return;
    }

    // Online English via LanguageTool
    if (textVal.length > 20000) { showToast(t('toastSpellcheckLong')); return; }
    spellcheckBusy = true;
    if (els.spellcheckBtn) {
      els.spellcheckBtn.classList.add('is-busy');
      els.spellcheckBtn.disabled = true;
    }
    showToast(t('toastSpellcheckBusy'));
    try {
      const matches = await requestSpellcheck(textVal, 'en-US');
      if (!matches.length) { showToast(t('toastSpellcheckNone')); return; }
      const { text: corrected, count } = applySpellcheckCorrections(textVal, matches);
      if (count <= 0) { showToast(t('toastSpellcheckNoSuggest')); return; }
      els.textarea.value = corrected;
      try {
        const end = els.textarea.value.length;
        els.textarea.setSelectionRange(end, end);
        els.textarea.focus();
      } catch (e) {}
      updateTokenMeter();
      saveDraftDebounced();
      showToast(t('toastSpellcheckFixed').replace('{n}', String(count)));
    } catch (err) {
      console.warn('[notepad] spellcheck failed:', err);
      showToast(t('toastSpellcheckFail'));
    } finally {
      spellcheckBusy = false;
      if (els.spellcheckBtn) {
        els.spellcheckBtn.classList.remove('is-busy');
        els.spellcheckBtn.disabled = false;
      }
    }
  }
  if (els.spellcheckBtn) {
    els.spellcheckBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runSpellcheck();
    });
  }

  // ============================= Online emoji vault =============================
  const EMOJI_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/@emoji-mart/data@latest/sets/15/native.json',
    'https://unpkg.com/@emoji-mart/data@latest/sets/15/native.json',
    'https://cdn.jsdelivr.net/npm/unicode-emoji-json@latest/data-by-group.json',
    'https://unpkg.com/unicode-emoji-json@latest/data-by-group.json'
  ];
  const EMOJI_CACHE_KEY = 'aiTreeOnlineEmojiCache_v5';
  const EMOJI_CACHE_MAX = 5000;
  const EMOJI_FA_HINTS = {
    'آتش': 'fire', 'شعله': 'fire', 'قلب': 'heart', 'عشق': 'heart', 'دوست': 'love',
    'خنده': 'grin', 'لبخند': 'smile', 'گریه': 'cry', 'اشک': 'tear', 'ناراحت': 'sad',
    'کتاب': 'book', 'ستاره': 'star', 'ماه': 'moon', 'خورشید': 'sun', 'گل': 'flower',
    'درخت': 'tree', 'ماشین': 'car', 'هواپیما': 'airplane', 'موشک': 'rocket',
    'کامپیوتر': 'computer', 'کد': 'laptop', 'تلفن': 'phone', 'موسیقی': 'music', 'آهنگ': 'song',
    'غذا': 'food', 'قهوه': 'coffee', 'چای': 'tea', 'کیک': 'cake', 'سیب': 'apple',
    'ورزش': 'sport', 'فوتبال': 'soccer', 'برنده': 'trophy', 'هدیه': 'gift', 'کادو': 'present',
    'تیک': 'check', 'خطا': 'cross', 'هشدار': 'warning', 'ایده': 'bulb', 'فکر': 'think',
    'پین': 'pushpin', 'یادداشت': 'memo', 'چشم': 'eye', 'دست': 'hand', 'انگشت': 'finger',
    'حیوان': 'animal', 'سگ': 'dog', 'گربه': 'cat', 'پرنده': 'bird', 'پول': 'money',
    'زمان': 'time', 'ساعت': 'clock', 'خانه': 'house', 'خواب': 'sleep', 'بیمار': 'sick',
    'سلام': 'wave', 'تشویق': 'clap', 'آفرین': 'thumbs up', 'جشن': 'party tada',
    'تولد': 'birthday cake', 'ایران': 'flag'
  };

  let cachedOnlineEmojis = null;
  let onlineEmojiPromise = null;

  // Infinite scroll state
  let currentEmojiResults = [];
  let currentEmojiRenderIndex = 0;
  const EMOJI_CHUNK_SIZE = 100;
  let emojiIntersectionObserver = null;

  function normalizeEmojiQuery(raw) {
    let q = String(raw || '').trim().toLowerCase();
    if (!q) return '';
    Object.keys(EMOJI_FA_HINTS).forEach((fa) => {
      if (q.includes(fa)) q += ' ' + EMOJI_FA_HINTS[fa];
    });
    return q.replace(/\s+/g, ' ').trim();
  }

  function fuzzyTokenScore(hay, token) {
    if (!token) return 1;
    if (!hay) return 0;
    if (hay === token) return 100;
    if (hay.startsWith(token)) return 90;
    const idx = hay.indexOf(token);
    if (idx >= 0) return 70 - Math.min(idx, 40);
    let hi = 0;
    for (let ti = 0; ti < token.length; ti++) {
      const ch = token.charCodeAt(ti);
      let found = false;
      while (hi < hay.length) {
        if (hay.charCodeAt(hi++) === ch) { found = true; break; }
      }
      if (!found) return 0;
    }
    return 35;
  }

  function scoreEmojiItem(item, parts) {
    if (!parts.length) return 1;
    const primary = (item.p || '').toLowerCase();
    const hay = (item.n || '').toLowerCase();
    let total = 0;
    for (let i = 0; i < parts.length; i++) {
      const tok = parts[i];
      const best = Math.max(
        fuzzyTokenScore(primary, tok) * 1.6,
        fuzzyTokenScore(hay, tok),
        (item.e && item.e.includes(tok)) ? 50 : 0
      );
      if (best <= 0) return 0;
      total += best;
    }
    return total;
  }

  function flattenEmojiCdnData(data) {
    const out = [];
    const seen = new Set();
    const pushItem = (emoji, primaryName, extraTags) => {
      if (!emoji || seen.has(emoji)) return;
      seen.add(emoji);
      const primary = String(primaryName || '').trim();
      const tags = Array.isArray(extraTags) ? extraTags.filter(Boolean).join(' ') : String(extraTags || '');
      const blob = (primary + ' ' + tags).toLowerCase().replace(/\s+/g, ' ').trim();
      out.push({ e: emoji, n: blob, p: primary.toLowerCase() });
    };
    if (data && data.emojis && typeof data.emojis === 'object' && !Array.isArray(data.emojis)) {
      Object.keys(data.emojis).forEach((id) => {
        const entry = data.emojis[id];
        if (!entry || typeof entry !== 'object') return;
        const native = (entry.skins && entry.skins[0] && (entry.skins[0].native || entry.skins[0].emoji))
          || entry.native || entry.emoji || entry.char;
        const keywords = [].concat(entry.keywords || [], entry.emoticons || [], id, entry.name || []);
        pushItem(native, entry.name || id, keywords);
      });
      return out.slice(0, EMOJI_CACHE_MAX);
    }
    const walkGroup = (group) => {
      if (!group) return;
      const list = group.emojis || group.emoji || (Array.isArray(group) ? group : null);
      if (!Array.isArray(list)) return;
      list.forEach((item) => {
        if (typeof item === 'string') pushItem(item, '', '');
        else if (item && typeof item === 'object') {
          pushItem(item.emoji || item.char || item.e || item.native, item.name || item.slug || item.n || '', [].concat(item.slug || [], item.group || []));
        }
      });
    };
    if (Array.isArray(data)) data.forEach(walkGroup);
    else if (data && typeof data === 'object') {
      Object.keys(data).forEach((k) => {
        const v = data[k];
        if (v && typeof v === 'object' && (v.emoji || v.char || v.native) && !v.emojis) {
          pushItem(v.emoji || v.char || v.native, v.description || v.name || k, [].concat(v.aliases || [], v.tags || [], k));
        } else walkGroup(v);
      });
    }
    return out.slice(0, EMOJI_CACHE_MAX);
  }

  function loadOnlineEmojisFromStorage() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([EMOJI_CACHE_KEY], (res) => {
          const pack = res && res[EMOJI_CACHE_KEY];
          if (pack && Array.isArray(pack.items) && pack.items.length > 50) resolve(pack.items);
          else resolve(null);
        });
      } catch (e) { resolve(null); }
    });
  }

  function saveOnlineEmojisToStorage(items) {
    try {
      chrome.storage.local.set({ [EMOJI_CACHE_KEY]: { ts: Date.now(), items: items.slice(0, EMOJI_CACHE_MAX) } });
    } catch (e) {}
  }

  async function fetchOnlineEmojis() {
    if (cachedOnlineEmojis && cachedOnlineEmojis.length) return cachedOnlineEmojis;
    if (onlineEmojiPromise) return onlineEmojiPromise;
    onlineEmojiPromise = (async () => {
      const fromStore = await loadOnlineEmojisFromStorage();
      if (fromStore && fromStore.length) {
        cachedOnlineEmojis = fromStore.map((it) => ({ e: it.e, n: it.n || '', p: it.p || (it.n ? String(it.n).split(' ')[0] : '') }));
        return cachedOnlineEmojis;
      }
      let lastErr = null;
      for (let i = 0; i < EMOJI_CDN_URLS.length; i++) {
        try {
          const res = await fetch(EMOJI_CDN_URLS[i], { credentials: 'omit', cache: 'force-cache' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          const flat = flattenEmojiCdnData(data);
          if (flat.length < 20) throw new Error('empty catalog');
          cachedOnlineEmojis = flat;
          saveOnlineEmojisToStorage(flat);
          return cachedOnlineEmojis;
        } catch (err) { lastErr = err; }
      }
      console.warn('[notepad] online emoji fetch failed:', lastErr);
      cachedOnlineEmojis = EMOJI_PICKER_GRID.map((e) => ({ e, n: '', p: '' }));
      return cachedOnlineEmojis;
    })();
    try { return await onlineEmojiPromise; }
    finally {
      if (!cachedOnlineEmojis || !cachedOnlineEmojis.length) onlineEmojiPromise = null;
    }
  }

  function searchOnlineEmojis(queryRaw, limit) {
    const source = cachedOnlineEmojis || [];
    const q = normalizeEmojiQuery(queryRaw);
    if (!q) {
      const cap = (limit == null) ? source.length : Math.min(limit, source.length);
      return source.slice(0, cap);
    }
    const parts = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (let i = 0; i < source.length; i++) {
      const s = scoreEmojiItem(source[i], parts);
      if (s > 0) scored.push({ s, item: source[i] });
    }
    scored.sort((a, b) => b.s - a.s);
    const cap = (limit == null) ? scored.length : Math.min(limit, scored.length);
    return scored.slice(0, cap).map((x) => x.item);
  }

  function renderOnlineEmojiGrid(queryRaw) {
    if (!els.emojiOnlineGrid) return;
    const grid = els.emojiOnlineGrid;

    if (emojiIntersectionObserver) {
      try { emojiIntersectionObserver.disconnect(); } catch (e) {}
      emojiIntersectionObserver = null;
    }

    // Full ranked list; infinite scroll renders in chunks
    currentEmojiResults = searchOnlineEmojis(queryRaw, null);
    currentEmojiRenderIndex = 0;
    grid.innerHTML = '';

    if (!currentEmojiResults.length) {
      const empty = document.createElement('div');
      empty.className = 'emoji-online-status';
      empty.textContent = t('emojiOnlineEmpty');
      grid.appendChild(empty);
      return;
    }

    renderNextEmojiChunk(grid);
  }

  function renderNextEmojiChunk(grid) {
    if (!grid) return;
    const frag = document.createDocumentFragment();
    const endIndex = Math.min(currentEmojiRenderIndex + EMOJI_CHUNK_SIZE, currentEmojiResults.length);

    for (let i = currentEmojiRenderIndex; i < endIndex; i++) {
      const item = currentEmojiResults[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-online-cell';
      btn.textContent = item.e;
      btn.title = item.p || item.n || item.e;
      btn.addEventListener('click', () => {
        insertEmojiAtCursor(item.e);
        closeOnlineEmojiModal();
      });
      frag.appendChild(btn);
    }

    currentEmojiRenderIndex = endIndex;

    const oldSentinel = grid.querySelector('.ai-emoji-sentinel');
    if (oldSentinel) oldSentinel.remove();

    grid.appendChild(frag);

    if (currentEmojiRenderIndex < currentEmojiResults.length) {
      const sentinel = document.createElement('div');
      sentinel.className = 'ai-emoji-sentinel';
      sentinel.style.gridColumn = '1 / -1';
      sentinel.style.height = '12px';
      grid.appendChild(sentinel);

      emojiIntersectionObserver = new IntersectionObserver((entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          try { emojiIntersectionObserver.disconnect(); } catch (e) {}
          emojiIntersectionObserver = null;
          renderNextEmojiChunk(grid);
        }
      }, { root: grid, rootMargin: '120px' });

      emojiIntersectionObserver.observe(sentinel);
    }
  }

  function closeOnlineEmojiModal() {
    if (els.emojiOnlineModal) els.emojiOnlineModal.classList.remove('open');
  }

  async function openOnlineEmojiModal() {
    if (!els.emojiOnlineModal) return;
    els.emojiPopover.classList.remove('open');
    if (els.emojiOnlineTitle) els.emojiOnlineTitle.textContent = t('emojiOnlineTitle');
    if (els.emojiOnlineSearch) {
      els.emojiOnlineSearch.placeholder = t('emojiOnlineSearch');
      els.emojiOnlineSearch.value = '';
    }
    if (els.emojiOnlineGrid) {
      els.emojiOnlineGrid.innerHTML = '<div class="emoji-online-status">' + t('emojiOnlineLoading') + '</div>';
    }
    els.emojiOnlineModal.classList.add('open');
    try {
      await fetchOnlineEmojis();
      renderOnlineEmojiGrid('');
      if (els.emojiOnlineSearch) setTimeout(() => els.emojiOnlineSearch.focus(), 40);
    } catch (err) {
      if (els.emojiOnlineGrid) {
        els.emojiOnlineGrid.innerHTML = '<div class="emoji-online-status">' + t('emojiOnlineError') + '</div>';
      }
    }
  }

  if (els.emojiOnlineBtn) {
    els.emojiOnlineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (els.emojiOnlineModal && els.emojiOnlineModal.classList.contains('open')) closeOnlineEmojiModal();
      else openOnlineEmojiModal();
    });
  }
  if (els.emojiOnlineClose) {
    els.emojiOnlineClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOnlineEmojiModal();
    });
  }
  if (els.emojiOnlineModal) {
    els.emojiOnlineModal.addEventListener('click', (e) => {
      if (e.target === els.emojiOnlineModal) closeOnlineEmojiModal();
    });
  }
  if (els.emojiOnlineSearch) {
    let searchTimer = null;
    els.emojiOnlineSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderOnlineEmojiGrid(els.emojiOnlineSearch.value), 80);
    });
    els.emojiOnlineSearch.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); closeOnlineEmojiModal(); }
    });
  }

  // ============================= AI dispatch =============================
  const AI_DISPATCH_CATALOG = [
    { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com', qParam: 'q' },
    { id: 'claude', label: 'Claude', url: 'https://claude.ai', qParam: null },
    { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app', qParam: null },
    { id: 'deepseek', label: 'DeepSeek', url: 'https://chat.deepseek.com', qParam: null },
    { id: 'grok', label: 'Grok', url: 'https://grok.com', qParam: 'q' },
    { id: 'perplexity', label: 'Perplexity', url: 'https://www.perplexity.ai', qParam: 'q' },
    { id: 'copilot', label: 'Copilot', url: 'https://copilot.microsoft.com', qParam: 'q' },
    { id: 'mistral', label: 'Mistral', url: 'https://chat.mistral.ai', qParam: null },
    { id: 'qwen', label: 'Qwen', url: 'https://chat.qwen.ai', qParam: null },
    { id: 'pi', label: 'Pi', url: 'https://pi.ai/talk', qParam: null },
    { id: 'metaai', label: 'Meta AI', url: 'https://www.meta.ai', qParam: null },
    { id: 'poe', label: 'Poe', url: 'https://poe.com', qParam: null },
    { id: 'you', label: 'You.com', url: 'https://you.com', qParam: null },
    { id: 'huggingchat', label: 'HuggingChat', url: 'https://huggingface.co/chat', qParam: null },
    { id: 'kimi', label: 'Kimi', url: 'https://www.kimi.com', qParam: null }
  ];
  const DEFAULT_NOTE_AI_ID = 'chatgpt';
  AI_DISPATCH_CATALOG.forEach((node) => {
    const opt = document.createElement('option');
    opt.value = node.id;
    opt.textContent = node.label;
    els.aiSelect.appendChild(opt);
  });
  els.aiSelect.value = DEFAULT_NOTE_AI_ID;

  function buildAiDispatchUrl(baseUrl, promptText, qParam) {
    if (!baseUrl || !promptText || !qParam) return baseUrl || '';
    try {
      const u = new URL(baseUrl);
      u.searchParams.set(qParam, promptText.trim());
      return u.toString();
    } catch (e) { return baseUrl; }
  }
  function pushPromptHistory(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    try {
      chrome.storage.local.get(['aiTreePromptHistory'], (res) => {
        let history = (res && Array.isArray(res.aiTreePromptHistory)) ? res.aiTreePromptHistory : [];
        history = [{ ts: Date.now(), text: trimmed }, ...history.filter(h => h.text !== trimmed)].slice(0, 10);
        chrome.storage.local.set({ aiTreePromptHistory: history });
      });
    } catch (e) {}
  }
  function sendPromptToSelectedAi() {
    const promptText = els.textarea.value.trim();
    if (!promptText) { showToast(t('dockEmptyPrompt')); return; }
    const node = AI_DISPATCH_CATALOG.find(n => n.id === els.aiSelect.value) || AI_DISPATCH_CATALOG[0];
    pushPromptHistory(promptText);
    const targetUrl = buildAiDispatchUrl(node.url, promptText, node.qParam);
    const openTab = () => window.open(targetUrl, '_blank', 'noopener,noreferrer');
    const notifyThenOpen = () => {
      const msg = (node.qParam ? t('dockOpenedFilled') : t('dockCopiedOpen')).replace('{name}', node.label);
      showToast(msg);
      setTimeout(openTab, 300);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(promptText).then(notifyThenOpen).catch(notifyThenOpen);
    } else {
      notifyThenOpen();
    }
  }
  els.sendBtn.addEventListener('click', sendPromptToSelectedAi);

  // ============================= Live two-way sync =============================
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.savedPromptDraft && !activeWorkNoteId && document.activeElement !== els.textarea) {
          const newVal = changes.savedPromptDraft.newValue || '';
          scratchDraftCache = newVal;
          if (newVal !== els.textarea.value) { els.textarea.value = newVal; updateTokenMeter(); }
        }
        if (changes[WORK_NOTES_KEY]) {
          workNotes = normalizeWorkNotes(changes[WORK_NOTES_KEY].newValue);
          const note = activeWorkNote();
          if (note && document.activeElement !== els.textarea) { els.textarea.value = note.text; updateTokenMeter(); }
          renderWorkNotes();
        }
        if (changes.aiTreeTodos) renderWorkNotes();
        if (changes.noteTextAlign && changes.noteTextAlign.newValue) setAlign(changes.noteTextAlign.newValue, false);
        if (changes.noteFontSize && changes.noteFontSize.newValue) applyFontSize(changes.noteFontSize.newValue, false);
        if (changes[CUSTOM_PROMPT_KEY]) { customPrompts = changes[CUSTOM_PROMPT_KEY].newValue || []; renderPrompts(); }
        if (changes[PROMPT_OVERRIDE_KEY]) { promptOverrides = changes[PROMPT_OVERRIDE_KEY].newValue || {}; renderPrompts(); }
        if (changes[PROMPT_HIDDEN_KEY]) { promptHiddenIds = changes[PROMPT_HIDDEN_KEY].newValue || []; renderPrompts(); }
        if (changes.aiTreeEmojiMemory) { favoriteEmojis = changes.aiTreeEmojiMemory.newValue || DEFAULT_FAVORITE_EMOJIS.slice(); }
      }
      if (area === 'sync' && changes.appLanguage) { currentLang = changes.appLanguage.newValue || 'en'; applyTranslation(); }
    });
  } catch (e) {}

  // ============================= Initial load =============================
  // noteTextAlign (chrome.storage.local) و appLanguage (chrome.storage.sync) دو
  // درخواستِ async مستقلِ همزمان‌ان. قبلاً وقتی کاربر هیچ‌وقت دستی align انتخاب
  // نکرده بود، default همیشه فیزیکیِ 'left' بود — مستقل از زبان. برای یک کاربرِ
  // فارسی/عربی که اولین بار دفترچه را باز می‌کند، یعنی متنِ راست‌چین (dir=auto
  // درست resolve می‌شود) داخلِ یک باکسِ چپ‌چین می‌نشیند: دقیقاً حالتِ «راست‌چین و
  // چپ‌چین همزمان» که مشکل‌ساز بود. حالا این دو نتیجه هماهنگ می‌شوند: default
  // (فقط وقتی کاربر قبلاً چیزی انتخاب نکرده) بر اساسِ جهتِ زبانِ تشخیص‌داده‌شده
  // محاسبه می‌شود، نه یک مقدارِ ثابت. انتخابِ دستیِ کاربر (noteTextAlign ذخیره‌شده)
  // همچنان همیشه اولویت دارد و دست‌نخورده می‌ماند.
  let _localLoadData = null;
  let _langReady = false;
  function maybeApplyDefaultAlign() {
    if (_localLoadData === null || !_langReady) return;
    if (!_localLoadData.noteTextAlign) {
      setAlign(isRTL(currentLang) ? 'right' : 'left', false);
    }
  }
  try {
    chrome.storage.local.get(
      ['savedPromptDraft', 'aiWorkNotes', 'noteTextAlign', 'noteFontSize', CUSTOM_PROMPT_KEY, PROMPT_OVERRIDE_KEY, PROMPT_HIDDEN_KEY, 'aiTreeEmojiMemory'],
      (data) => {
        scratchDraftCache = (data && typeof data.savedPromptDraft === 'string') ? data.savedPromptDraft : '';
        workNotes = normalizeWorkNotes(data && data[WORK_NOTES_KEY]);
        const requestedNote = activeWorkNote();
        if (requestedNote) els.textarea.value = requestedNote.text;
        else { activeWorkNoteId = null; els.textarea.value = scratchDraftCache; }
        lastValueForEmoji = els.textarea.value;
        if (data && data.noteTextAlign) setAlign(data.noteTextAlign, false);
        _localLoadData = data || {};
        maybeApplyDefaultAlign();
        applyFontSize((data && data.noteFontSize) || FONT_DEFAULT, false);
        if (data && Array.isArray(data[CUSTOM_PROMPT_KEY])) customPrompts = data[CUSTOM_PROMPT_KEY];
        if (data && data[PROMPT_OVERRIDE_KEY] && typeof data[PROMPT_OVERRIDE_KEY] === 'object') promptOverrides = data[PROMPT_OVERRIDE_KEY];
        if (data && Array.isArray(data[PROMPT_HIDDEN_KEY])) promptHiddenIds = data[PROMPT_HIDDEN_KEY];
        if (data && Array.isArray(data.aiTreeEmojiMemory) && data.aiTreeEmojiMemory.length) favoriteEmojis = data.aiTreeEmojiMemory.slice(0, 12);
        renderWorkNotes();
        updateTokenMeter();
        renderPrompts();
      }
    );
    chrome.storage.sync.get(['appLanguage'], (data) => {
      currentLang = (data && data.appLanguage) || 'en';
      applyTranslation();
      _langReady = true;
      maybeApplyDefaultAlign();
    });
  } catch (e) {
    applyTranslation();
  }

  els.textarea.focus();

  // --- Back button: return to the widget's tab if known, otherwise just close this tab ---
  const params = new URLSearchParams(window.location.search);
  const fromTab = params.get('fromTab');
  const fromWindow = params.get('fromWindow');
  els.backBtn.addEventListener('click', () => {
    try {
      flushCurrentNote();
      const flush = activeWorkNoteId ? { [WORK_NOTES_KEY]: workNotes } : { savedPromptDraft: els.textarea.value };
      chrome.storage.local.set(flush, () => {
        if (fromTab) {
          chrome.runtime.sendMessage({
            action: 'returnToParentTab',
            tabId: fromTab,
            windowId: fromWindow || undefined
          }, () => { void chrome.runtime.lastError; });
        } else {
          // این تب مستقیم (بدون ارجاع به تب مبدأ) باز شده — فقط خودش را می‌بندد
          window.close();
        }
      });
    } catch (e) {}
  });
});
