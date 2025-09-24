/**
 * @file This module handles the diagnostics for multi-threading support.
 */

let mtDiagnosticsElement = null;

function init() {
    if (!mtDiagnosticsElement) {
        mtDiagnosticsElement = document.getElementById('mtDiagnostics');
    }
}

export async function runDiagnostics() {
    init();
    if (!mtDiagnosticsElement) {
        console.error("Diagnostics UI element #mtDiagnostics not found.");
        return;
    }

    const secure = window.isSecureContext ? '✅ Secure Context (localhost/https)' : '❌ Not a Secure Context';
    let coop = '...';
    let coep = '...';

    try {
        const res = await fetch(window.location.href, {method: 'GET', cache: 'no-store'});
        coop = res.headers.get('Cross-Origin-Opener-Policy') === 'same-origin' ? '✅ COOP Header: same-origin' : `❌ COOP Header: ${res.headers.get('Cross-Origin-Opener-Policy') || 'not set'}`;
        coep = res.headers.get('Cross-Origin-Embedder-Policy') === 'require-corp' ? '✅ COEP Header: require-corp' : `❌ COEP Header: ${res.headers.get('Cross-Origin-Embedder-Policy') || 'not set'}`;
    } catch (e) {
        coop = '❌ Could not check headers';
        coep = '❌ Could not check headers';
    }

    const isolated = window.crossOriginIsolated ? '✅ Browser is Cross-Origin Isolated' : '❌ Browser is NOT Cross-Origin Isolated';
    mtDiagnosticsElement.innerHTML = `${secure}<br>${coop}<br>${coep}<br>${isolated}`;
}