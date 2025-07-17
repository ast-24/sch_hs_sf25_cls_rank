const ids = ['default', 'latest_round', 'all'];
let idx = 0;

function show(idxToShow) {
    ids.forEach((id, i) => {
        document.getElementById(id).style.display = (i === idxToShow) ? 'block' : 'none';
    });
}

function next() {
    idx = (idx + 1) % ids.length;
    show(idx);
}

window.addEventListener('DOMContentLoaded', () => {
    show(idx);
    document.body.addEventListener('click', next);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') next();
    });
});
