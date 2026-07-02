(function() {
    // ---------- Конфигурация ----------
    const MAX_TAPS = 12;
    const TIMEOUT_MS = 3000;          // пауза для сброса истории нажатий (но BPM не исчезает)
    const STORAGE_KEY = 'tapTempoRecords';

    // ---------- DOM-элементы ----------
    const tapButton = document.getElementById('tap-button');
    const resetButton = document.getElementById('reset-button');
    const saveButton = document.getElementById('save-button');
    const bpmValue = document.getElementById('bpm-value');
    const tapCount = document.getElementById('tap-count');
    const lastTap = document.getElementById('last-tap');

    const recordsList = document.getElementById('records-list');
    const filterInput = document.getElementById('filter-input');
    const sortSelect = document.getElementById('sort-select');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    const modalOverlay = document.getElementById('modal-overlay');
    const modalBpm = document.getElementById('modal-bpm');
    const songNameInput = document.getElementById('song-name');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');

    // ---------- Состояние ----------
    let taps = [];
    let lastValidBpm = null;          // последний вычисленный BPM (сохраняется даже после паузы)
    let currentBpm = null;            // для кнопки "Сохранить" (равен lastValidBpm, если есть)

    let records = [];

    // ---------- Работа с localStorage ----------
    function loadRecords() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            records = data ? JSON.parse(data) : [];
        } catch (e) {
            records = [];
        }
    }

    function saveRecords() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    // ---------- Рендеринг списка записей ----------
    function renderRecords() {
        const filter = filterInput.value.toLowerCase().trim();
        const sortType = sortSelect.value;

        let filtered = records.filter(rec => rec.name.toLowerCase().includes(filter));

        switch (sortType) {
            case 'name-asc':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                filtered.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'bpm-asc':
                filtered.sort((a, b) => a.bpm - b.bpm);
                break;
            case 'bpm-desc':
                filtered.sort((a, b) => b.bpm - a.bpm);
                break;
            case 'newest':
                filtered.sort((a, b) => b.timestamp - a.timestamp);
                break;
            case 'oldest':
                filtered.sort((a, b) => a.timestamp - b.timestamp);
                break;
            default:
                break;
        }

        if (filtered.length === 0) {
            recordsList.innerHTML = `<div class="empty-message">Нет сохранённых песен</div>`;
            return;
        }

        let html = '';
        filtered.forEach(rec => {
            html += `
                <div class="record-item" data-id="${rec.id}">
                    <div class="record-info">
                        <span class="record-name" title="${escapeHtml(rec.name)}">${escapeHtml(rec.name)}</span>
                        <span class="record-bpm">${rec.bpm} BPM</span>
                    </div>
                    <div class="record-actions">
                        <button class="edit-btn" data-id="${rec.id}" title="Редактировать">✏️</button>
                        <button class="delete-btn" data-id="${rec.id}" title="Удалить">🗑️</button>
                    </div>
                </div>
            `;
        });
        recordsList.innerHTML = html;

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const rec = records.find(r => r.id === id);
                if (rec) editRecord(rec);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (confirm('Удалить эту запись?')) {
                    records = records.filter(r => r.id !== id);
                    saveRecords();
                    renderRecords();
                }
            });
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---------- Редактирование записи ----------
    function editRecord(rec) {
        modalBpm.textContent = rec.bpm;
        songNameInput.value = rec.name;
        modalOverlay.dataset.editId = rec.id;
        modalConfirm.textContent = 'Обновить';
        modalOverlay.classList.remove('hidden');
        songNameInput.focus();
    }

    function saveNewRecord(name, bpm) {
        const newRec = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random(),
            name: name.trim(),
            bpm: bpm,
            timestamp: Date.now()
        };
        records.push(newRec);
        saveRecords();
        renderRecords();
    }

    function updateRecord(id, newName) {
        const rec = records.find(r => r.id === id);
        if (rec) {
            rec.name = newName.trim();
            rec.timestamp = Date.now();
            saveRecords();
            renderRecords();
        }
    }

    // ---------- Модальное окно ----------
    function openSaveModal() {
        if (currentBpm === null) return;
        modalBpm.textContent = currentBpm;
        songNameInput.value = '';
        modalOverlay.dataset.editId = '';
        modalConfirm.textContent = 'Сохранить';
        modalOverlay.classList.remove('hidden');
        songNameInput.focus();
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
        songNameInput.value = '';
        delete modalOverlay.dataset.editId;
    }

    modalCancel.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    modalConfirm.addEventListener('click', () => {
        const name = songNameInput.value.trim();
        if (!name) {
            alert('Введите название песни');
            return;
        }
        const editId = modalOverlay.dataset.editId;
        if (editId) {
            updateRecord(editId, name);
        } else {
            const bpm = parseInt(modalBpm.textContent);
            if (!isNaN(bpm) && bpm > 0) {
                saveNewRecord(name, bpm);
            } else {
                alert('Ошибка: BPM не определён');
            }
        }
        closeModal();
    });

    songNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') modalConfirm.click();
    });

    // ---------- Логика Tap Tempo (с сохранением BPM) ----------
    function updateUI() {
        const count = taps.length;
        tapCount.textContent = `Нажатий: ${count}`;

        // Если есть хотя бы 2 нажатия, вычисляем BPM и сохраняем его
        if (count >= 2) {
            let intervals = [];
            for (let i = 1; i < taps.length; i++) {
                intervals.push(taps[i] - taps[i-1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const bpm = Math.round(60 / (avgInterval / 1000));
            if (bpm > 20 && bpm < 300) {
                lastValidBpm = bpm;
            } else {
                // Если BPM вне диапазона, оставляем предыдущий lastValidBpm (не обновляем)
            }
        }

        // Отображение текущего BPM
        if (lastValidBpm !== null) {
            bpmValue.textContent = lastValidBpm;
            currentBpm = lastValidBpm;
            saveButton.disabled = false;
        } else {
            bpmValue.textContent = '--';
            currentBpm = null;
            saveButton.disabled = true;
        }

        // Отображение последнего интервала (если есть)
        if (count >= 2) {
            const lastInterval = taps[taps.length - 1] - taps[taps.length - 2];
            if (lastInterval > 0) {
                const lastBpm = Math.round(60 / (lastInterval / 1000));
                lastTap.textContent = `Последний: ${lastBpm} BPM`;
            } else {
                lastTap.textContent = 'Последний: --';
            }
        } else {
            // Если нажатий меньше 2, показываем последний сохранённый BPM (если есть)
            if (lastValidBpm !== null) {
                lastTap.textContent = `Последний: ${lastValidBpm} BPM`;
            } else {
                lastTap.textContent = 'Последний: --';
            }
        }
    }

    function addTap() {
        const now = Date.now();

        // Если прошло много времени после последнего нажатия — начинаем новый отсчёт
        if (taps.length > 0 && (now - taps[taps.length - 1]) > TIMEOUT_MS) {
            taps = [];                // сбрасываем историю, но lastValidBpm остаётся
        }

        taps.push(now);
        if (taps.length > MAX_TAPS) {
            taps.shift();
        }
        updateUI();
    }

    function resetTaps() {
        taps = [];
        lastValidBpm = null;          // полный сброс
        updateUI();
        bpmValue.style.color = '#e94560';
        setTimeout(() => bpmValue.style.color = '', 200);
    }

    // ---------- Обработчики событий ----------
    tapButton.addEventListener('click', addTap);
    tapButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        addTap();
    });

    resetButton.addEventListener('click', resetTaps);
    saveButton.addEventListener('click', openSaveModal);

    filterInput.addEventListener('input', renderRecords);
    sortSelect.addEventListener('change', renderRecords);

    // ---------- Экспорт CSV ----------
    function exportCSV() {
        if (records.length === 0) {
            alert('Нет записей для экспорта');
            return;
        }
        let csv = 'BPM,Название\n';
        records.forEach(rec => {
            const name = rec.name.replace(/"/g, '""');
            csv += `${rec.bpm},"${name}"\n`;
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `tap_tempo_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    exportBtn.addEventListener('click', exportCSV);

    // ---------- Импорт CSV ----------
    importBtn.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                alert('Файл пуст или неверный формат');
                return;
            }
            let imported = 0;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].replace(/^\uFEFF/, '');
                const parts = parseCSVLine(line);
                if (parts.length >= 2) {
                    const bpm = parseInt(parts[0]);
                    const name = parts[1].trim();
                    if (!isNaN(bpm) && name) {
                        const exists = records.some(r => r.name === name && r.bpm === bpm);
                        if (!exists) {
                            records.push({
                                id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random(),
                                name: name,
                                bpm: bpm,
                                timestamp: Date.now()
                            });
                            imported++;
                        }
                    }
                }
            }
            if (imported > 0) {
                saveRecords();
                renderRecords();
                alert(`Импортировано ${imported} записей`);
            } else {
                alert('Не удалось импортировать записи. Проверьте формат (BPM,Название)');
            }
            importFile.value = '';
        };
        reader.readAsText(file, 'UTF-8');
    });

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i+1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        result.push(current.trim());
        return result;
    }

    // ---------- Инициализация ----------
    loadRecords();
    renderRecords();
    updateUI();

    window.addEventListener('beforeunload', saveRecords);
})();