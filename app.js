(function() {
    // Конфигурация
    const MAX_TAPS = 12;          // храним последние N нажатий
    const TIMEOUT_MS = 3000;      // сброс, если пауза больше этого (в мс)

    const tapButton = document.getElementById('tap-button');
    const resetButton = document.getElementById('reset-button');
    const bpmValue = document.getElementById('bpm-value');
    const tapCount = document.getElementById('tap-count');
    const lastTap = document.getElementById('last-tap');

    let taps = [];               // массив временных меток (мс)
    let timeoutId = null;

    // Обновление интерфейса
    function updateUI() {
        const count = taps.length;
        tapCount.textContent = `Нажатий: ${count}`;

        if (count < 2) {
            bpmValue.textContent = '--';
            lastTap.textContent = 'Последний: --';
            return;
        }

        // Вычисляем средний интервал между последними нажатиями
        // (используем все taps, но можно ограничить MAX_TAPS)
        let intervals = [];
        for (let i = 1; i < taps.length; i++) {
            intervals.push(taps[i] - taps[i-1]);
        }
        // Усредняем
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const bpm = Math.round(60 / (avgInterval / 1000));

        // Ограничим разумный диапазон
        const displayBpm = (bpm > 20 && bpm < 300) ? bpm : '--';
        bpmValue.textContent = displayBpm;

        // Последний интервал
        const lastInterval = intervals[intervals.length - 1];
        if (lastInterval) {
            lastTap.textContent = `Последний: ${Math.round(60 / (lastInterval / 1000))} BPM`;
        } else {
            lastTap.textContent = 'Последний: --';
        }
    }

    // Добавление нажатия
    function addTap() {
        const now = Date.now();

        // Если прошло слишком много времени — сбрасываем
        if (taps.length > 0 && (now - taps[taps.length - 1]) > TIMEOUT_MS) {
            taps = [];
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        taps.push(now);

        // Ограничиваем длину массива
        if (taps.length > MAX_TAPS) {
            taps.shift();
        }

        updateUI();

        // Автосброс через TIMEOUT_MS после последнего нажатия
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            taps = [];
            updateUI();
            timeoutId = null;
        }, TIMEOUT_MS);
    }

    // Сброс вручную
    function resetTaps() {
        taps = [];
        clearTimeout(timeoutId);
        timeoutId = null;
        updateUI();
        // Визуальный отклик
        bpmValue.style.color = '#e94560';
        setTimeout(() => bpmValue.style.color = '', 200);
    }

    // Обработчики событий
    tapButton.addEventListener('click', addTap);
    tapButton.addEventListener('touchstart', (e) => {
        // Предотвращаем двойное срабатывание на мобильных
        e.preventDefault();
        addTap();
    });
    resetButton.addEventListener('click', resetTaps);

    // Начальное состояние
    updateUI();

    // Для отладки (можно удалить)
    console.log('Tap Tempo PWA загружен');
})();