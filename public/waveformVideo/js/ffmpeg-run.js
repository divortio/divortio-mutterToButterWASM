/**
 * @file A centralized and robust helper for executing FFmpeg commands.
 * This module ensures that all FFmpeg errors are caught and reported with rich context.
 */

/**
 * Executes an FFmpeg command with robust error handling.
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string[]} args - An array of arguments for the FFmpeg command.
 * @param {object} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<void>}
 * @throws {Error} Throws a detailed error if the command fails.
 */
export async function runFFmpeg(ffmpeg, args, updateUI, logStore) {
    const strArgs = args.join(' ')
    console.log(strArgs)
    const commandString = `ffmpeg ${strArgs}`;
    if (updateUI) {
        updateUI({command: commandString});
    }
    console.log("Executing FFmpeg command:", commandString);

    try {
        // FIX: The ffmpeg.exec function requires arguments to be spread, not passed as an array.
        const result = await ffmpeg.exec(args);
        if (result !== 0) {
            // This catches errors reported by FFmpeg's return code and includes the logs
            throw new Error(`FFmpeg exited with a non-zero status code: ${result}.\n\nFull Log:\n${logStore.get()}`);
        }
    } catch (error) {
        // This catches crashes or exceptions within the WASM module itself
        const detailedError = `FFmpeg command failed: ${error.message}\n\nFailed Command:\n${commandString}\n\nFull Log:\n${logStore.get()}`;
        // Re-throw a more informative error
        throw new Error(detailedError);
    }
}