/**
 * @file A dedicated helper module for parsing FFmpeg's analysis output files.
 */

/**
 * @typedef {object} LoudnessData
 * @property {string} measured_I - The measured integrated loudness.
 * @property {string} measured_TP - The measured true peak.
 * @property {string} measured_LRA - The measured loudness range.
 * @property {string} measured_thresh - The measured threshold.
 * @property {string} target_offset - The calculated target offset.
 */

/**
 * Parses the FFmpeg log output to find and extract the JSON block generated
 * by the `loudnorm` filter's first pass.
 */
export function parseLoudness(logText) {
    const jsonStart = logText.lastIndexOf('{');
    const jsonEnd = logText.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
        throw new Error("Log Parser Failed: Could not find the loudnorm JSON block in the FFmpeg logs.");
    }

    const jsonString = logText.substring(jsonStart, jsonEnd + 1);

    try {
        const parsed = JSON.parse(jsonString);
        return {
            measured_I: parsed.input_i,
            measured_TP: parsed.input_tp,
            measured_LRA: parsed.input_lra,
            measured_thresh: parsed.input_thresh,
            target_offset: parsed.target_offset,
        };
    } catch (e) {
        throw new Error(`Log Parser Failed: Could not parse the loudnorm JSON data. Details: ${e.message}`);
    }
}

/**
 * Parses the ametadata file content to find the RMS level.
 * @param {string} fileContent - The string content of the ametadata output file.
 * @returns {number} The measured RMS level in dB.
 * @throws {Error} If the RMS level cannot be found.
 */
export function parseRmsLevel(fileContent) {
    // This is the user-provided, correct regex.
    const rmsRegex = /Overall\.RMS_level=(.+)/;
    const match = fileContent.match(rmsRegex);

    if (match && match[1]) {
        // This correctly handles parsing '-inf' by defaulting to 0.00
        return parseFloat(match[1]) || 0.00;
    }
    throw new Error("Log Parser Failed: Could not find Overall.RMS_level in the analysis file.");
}