let state;
let paused = true;
let bridge;
const board = document.querySelector('#board');
const label = document.querySelector('#status');
const manifest = JSON.parse(document.querySelector('#pyamooz-game-meta').textContent);
function render() {
    board.replaceChildren();
    state.cards.forEach((value, index) => {
        const button = document.createElement('button');
        const visible = state.matched.includes(index) || state.open.includes(index);
        button.textContent = visible ? String(value) : '؟';
        button.setAttribute('aria-label', `خانهٔ ${index + 1}${visible ? ': ' + value : '، بسته'}`);
        button.disabled = paused || state.matched.includes(index);
        button.addEventListener('click', () => {
            if (paused || state.open.includes(index)) return;
            if (state.open.length === 2) state.open = [];
            state.open.push(index);
            if (state.open.length === 2) {
                state.moves++;
                if (state.cards[state.open[0]] === state.cards[state.open[1]]) { state.matched.push(...state.open); state.open = []; }
            }
            render();
            if (state.matched.length === state.cards.length) bridge.finish('won', {moves: state.moves}, 0);
            else bridge.save();
        });
        board.append(button);
    });
}
bridge = createGameBridge({manifest,
    restore(saved) { state = saved || {cards: [1, 3, 2, 4, 3, 1, 4, 2], open: [], matched: [], moves: 0}; render(); },
    snapshot: () => state,
    pause(value) { paused = value; render(); },
    preferences(value) { document.documentElement.dataset.theme = value.theme === 'dark' ? 'dark' : 'light'; },
    status(value) { label.textContent = value === 'finished' ? 'همهٔ جفت‌ها پیدا شدند.' : ['local', 'server'].includes(value) ? 'پیشرفت ذخیره شد.' : value === 'ready' ? 'برای ادامه دکمه را بزن.' : value.includes('UNAVAILABLE') ? 'ذخیره در دسترس نیست؛ صفحه را نبند.' : ''; },
});
document.querySelector('#resume').addEventListener('click', () => bridge.resume());
