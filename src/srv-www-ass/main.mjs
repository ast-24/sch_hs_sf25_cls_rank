(async () => {
    const cssUrl = 'https://site-b.example/component.css';
    const htmlUrl = 'https://site-b.example/component.html';
    const module = await import('https://site-b.example/module.js');

    // CSSをheadに追加
    const css = await fetch(cssUrl).then(r => r.text());
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // HTMLをappに追加
    const html = await fetch(htmlUrl).then(r => r.text());
    document.getElementById('app').innerHTML = html;
})();