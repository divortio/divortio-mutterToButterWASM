/**
 * @file This module handles the diagnostics for multi-threading support.
 */

/**
 * A collection of DOM elements used by the diagnostics module.
 * @private
 * @type {{mtDiagnostics: HTMLElement|null}}
 */
const dom = {};

/**
 * Initializes the diagnostics module by finding its required DOM elements.
 * This must be called after the DOM has loaded.
 */
export function initDiagnostics() {
    dom.mtDiagnostics = document.getElementById('mt-diagnostics');
}

/**
 * Runs and displays diagnostics for multi-threading support.
 */
export async function runDiagnostics() {
    if (!dom.mtDiagnostics) {
        console.error("Diagnostics UI not initialized. Call initDiagnostics() first.");
        return;
    }
    console.log("Diagnostics: Running diagnostics.");
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
        console.error("Diagnostics: Network error checking headers.", e);
    }

    const isolated = window.crossOriginIsolated ? '✅ Browser is Cross-Origin Isolated' : '❌ Browser is NOT Cross-Origin Isolated';
    dom.mtDiagnostics.innerHTML = `${secure}<br>${coop}<br>${coep}<br>${isolated}`;
}