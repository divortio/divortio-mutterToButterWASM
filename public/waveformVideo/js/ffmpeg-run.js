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
    const commandString = `ffmpeg ${args.join(' ')}`;
    if (updateUI) {
        updateUI({command: commandString});
    }
    console.log("Executing FFmpeg command:", commandString);

    try {
        let result;


        result = await ffmpeg.exec(args);

        // ------------------------

        if (result !== 0) {
            throw new Error(`FFmpeg exited with a non-zero status code: ${result}.\n\nFull Log:\n${logStore.get()}`);
        }
    } catch (error) {
        const detailedError = `FFmpeg command failed: ${error.message}\n\nFailed Command:\n${commandString}\n\nFull Log:\n${logStore.get()}`;
        throw new Error(detailedError);
    }
}