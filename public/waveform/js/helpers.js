let timerInterval = null;

export function startTimer(timerElement) {
    let seconds = 0;
    timerElement.textContent = '00:00';
    stopTimer(); // Ensure no multiple timers are running
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        timerElement.textContent = `${mins}:${secs}`;
    }, 1000);
}

export function stopTimer() {
    clearInterval(timerInterval);
}

export function formatDurationTimestamp(s) {
    if (isNaN(s) || s < 0) return '00:00:00.000';
    return new Date(s * 1000).toISOString().substr(11, 12);
}

export function formatDurationVerbose(s) {
    if (isNaN(s) || s < 0) return 'N/A';
    const h = Math.floor(s / 3600);
    s %= 3600;
    const m = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const parts = [];
    if (h > 0) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs} second${secs > 1 ? 's' : ''}`);
    return parts.join(', ');
}