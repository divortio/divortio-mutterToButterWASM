#!/bin/bash

################################################################################
#
# Divortio Audio Cleaner
#
# Version: 4.0 - Stable Workflow
#
# Description:
# This is the main user-facing script. It manages a resilient, auditable, and
# parallel "chunk, process, reassemble" workflow for cleaning audio. This version
# preserves original channel layouts during processing.
#
################################################################################

# --- Script Configuration & Color Definitions ---
C_RESET='\033[0m'
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[0;33m'
C_CYAN='\033[0;36m'
C_BOLD='\033[1m'

# --- Global Variables for Cleanup Trap ---
SHOULD_CLEANUP=true
TEMP_DIR=""
TEMP_FILE_LIST=""
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)

# --- Cleanup Function and Exit Trap ---
cleanup() {
	if  [ "$SHOULD_CLEANUP" = true ]; then
		echo   -e "${C_YELLOW}\nCleaning up temporary files...${C_RESET}"
		if   [ -d "$TEMP_DIR" ]; then rm -r "$TEMP_DIR"; fi
		if   [ -f "$TEMP_FILE_LIST" ]; then rm "$TEMP_FILE_LIST"; fi
		echo   -e "${C_GREEN}Cleanup complete.${C_RESET}"
	else
		echo   -e "${C_YELLOW}\n--no-cleanup flag set or error occurred. Temporary files preserved in: $TEMP_DIR${C_RESET}"
	fi
}

trap cleanup EXIT

# --- Usage and Help Function ---
usage() {
	echo  -e "${C_BOLD}Usage:${C_RESET} $0 -i <IN_FILE_PATH> [options]"
	echo
	echo  -e "${C_BOLD}Required:${C_RESET}"
	echo  -e "  -i, --input      <path>   Path to the input audio file."
	echo
	echo  -e "${C_BOLD}Output & Quality Options:${C_RESET}"
	echo  -e "  -o, --output     <path>   Full filepath for the final output MP3. (Default: [input_dir]/[filename]_proc.mp3)"
	echo  -e "  --quality-high            Set output to HIGH quality VBR (~130 kbps, -q:a 5). Overrides default."
	echo  -e "  --quality-medium          Set output to MEDIUM quality VBR (~100 kbps, -q:a 7). Overrides default."
	echo  -e "  --quality-low             Set output to LOW quality VBR (~65 kbps, -q:a 9). (Default)"
	echo
	echo  -e "${C_BOLD}Other Options:${C_RESET}"
	echo  -e "  --temp-dir       <path>   Directory for temporary CHUNKS_LIST. (Default: /tmp/[IN_FILE_PATH_hash])"
	echo  -e "  --log-file       <path>   Full filepath for the processing receipt log."
	echo  -e "  --no-cleanup              Flag to prevent deletion of temporary files."
	echo  -e "  --force                   Force overwrite of the output file without prompting."
	echo  -e "  --dry-run                 Show all commands that would be run without executing them."
	echo  -e "  -p, --parallel   <jobs>   Number of parallel jobs. (Default: all CPU cores; 0 or 1 for serial)"
	echo  -e "  -g, --gate                Enable dynamic noise gating."
	echo  -e "  -c, --clarity-boost       Enable high-frequency boost."
	echo  -e "  -t, --tonal-eq            Enable Tonal EQ (Warmth)"
	echo  -e "  -s, --soft-clip           Enable Soft Clip"
	echo  -e "  -h, --help                Display this help message and exit."
	exit  1
}


# --- Helper Functions ---
get_file_md5() {
	if  command -v md5sum &>/dev/null; then
		md5sum   "$1" | awk '{print $1}'
	elif  command -v md5 &>/dev/null; then
		md5   -q "$1"
	else
		echo   "(md5 utility not found)"
	fi
}

# --- Script Start & Argument Parsing ---
SCRIPT_START_TIME=$(date +%s)
IN_FILE_PATH=""
OUT_FILE_PATH=""
LOGFILE_PATH=""
PASS_ARGS=""
SCRIPT_ARGS=""
MAX_JOBS=$(getconf _NPROCESSORS_ONLN)
IS_DRY_RUN=false
OUTPUT_BIT_RATE="-q:a 9"

while [[ $# -gt 0 ]]; do
	key="$1"
	case $key in
		-i | --input)
			IN_FILE_PATH="$2"
			shift
			shift
			;;
		-o | --output)
			OUT_FILE_PATH="$2"
			shift
			shift
			;;
		--temp-dir)
			TEMP_DIR="$2"
			shift
			shift
			;;
		--log-file)
			LOGFILE_PATH="$2"
			shift
			shift
			;;
		--no-cleanup)
			SHOULD_CLEANUP=false
			shift
			;;
		--dry-run)
			IS_DRY_RUN=true
			shift
			;;
		-p | --parallel)
			MAX_JOBS="$2"
			shift
			shift
			;;
		-g | --gate)
			SCRIPT_ARGS+=" -g"
			shift
			;;
		-c | --clarity-boost)
			SCRIPT_ARGS+=" -c"
			shift
			;;
		-t |  --tonal-eq)
			SCRIPT_ARGS+=" -t"
			shift
			;;
		-s |  --soft-clip)
			SCRIPT_ARGS+=" -s"
			shift
			;;
		--quality-high)
			OUTPUT_BIT_RATE="-q:a 5"
			shift
			;;
		--quality-medium)
			OUTPUT_BIT_RATE="-q:a 7"
			shift
			;;
		--quality-low)
			OUTPUT_BIT_RATE="-q:a 9"
			shift
			;;
		-h | --help) usage ;;
		*)
			echo  -e "${C_RED}Error: Unknown option '$1'${C_RESET}"
			usage
			;;
	esac
done

# --- Validation, Path Standardization, and Hashing ---
if [[ -z "$IN_FILE_PATH" ]]; then
	echo  -e "${C_RED}Error: Input file is required.${C_RESET}"
	usage
fi

# Check input file from arguments exists
if [ ! -f "$IN_FILE_PATH" ]; then
	echo  -e "${C_RED}Error: Input file not found at '$IN_FILE_PATH'${C_RESET}"
	exit  1
fi

# Check child script exists to execute CHUNKS_LIST
if [ ! -f "$SCRIPT_DIR/lib/_process-chunk.sh" ]; then
	echo  -e "${C_RED}Error: Worker script 'lib/_process-chunk.sh' not found.${C_RESET}"
	exit  1
fi

## Check Dependencies
for cmd in ffmpeg ffprobe bc jq realpath; do if ! command -v $cmd &>/dev/null; then
	echo  -e "${C_RED}Error: Required command '$cmd' is not found. Please run an installer.${C_RESET}"
	exit  1
fi; done

IN_FILE_ABS=$(realpath "${IN_FILE_PATH}")
IN_FILE_NAME=$(basename "${IN_FILE_PATH}")
IN_FILE_MD5=$(get_file_md5 "$IN_FILE_ABS")
IN_FILE_DIR=$(basename "${IN_FILE_PATH%.*}")

LOG_TIMESTAMP=$(date -u +%Y-%m-%dT%H%M%SZ)

if [[ -z "$TEMP_DIR" ]]; then
	TEMP_DIR="/tmp/$IN_FILE_MD5"
fi
if [[ -z "$OUT_FILE_PATH" ]]; then
	OUT_FILE_PATH="$( dirname "$IN_FILE_ABS")/${IN_FILE_DIR}_proc.mp3"
fi
if [[ -z "$LOGFILE_PATH" ]]; then
	LOGFILE_PATH="$TEMP_DIR/processing_receipt_${SCRIPT_START_TIME}.log"
fi

OUT_FILE_PATH=$(realpath -m "$OUT_FILE_PATH")
TEMP_DIR=$(realpath -m "$TEMP_DIR")
LOGFILE_PATH=$(realpath -m "$LOGFILE_PATH")
mkdir -p "$TEMP_DIR" "$(dirname "$OUT_FILE_PATH")" "$(dirname "$LOGFILE_PATH")"

# --- Metadata Preparation ---
echo -e "${C_YELLOW}Gathering metadata for MP3 tags...${C_RESET}"
AUDIO_DUR_SEC=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$IN_FILE_ABS")

AUDIO_DUR_H=$(date -u -d @"${AUDIO_DUR_SEC%.*}" +'%Hh %Mm %Ss')
IN_FILE_CDATE=$(stat -c %y "$IN_FILE_ABS" 2>/dev/null || stat -f %SB -t %Y-%m-%d "$IN_FILE_ABS")
IN_FILE_CDATE=$(echo "${IN_FILE_CDATE}" | awk '{print $1}')

MP3_DATE="${IN_FILE_CDATE}"
MP3_TITLE="${IN_FILE_NAME} (${IN_FILE_CDATE}) - ${AUDIO_DUR_H} - ${LOG_TIMESTAMP}"
MP3_ARTIST="mutterToButter"
MP3_ALBUM_ARTIST="divort.io"
MP3_ALBUM="$IN_FILE_CDATE"
MP3_GENRE="RECORDING"
MP3_COMMENT="MD5: ${IN_FILE_MD5}"

PASS_ARGS_MP3=""
PASS_ARGS_MP3+="--mp3-comment \"${MP3_COMMENT}\" --mp3-genre \"${MP3_GENRE}\" --mp3-album-artist \"${MP3_ALBUM_ARTIST}\" --mp3-date \"${MP3_DATE}\" --mp3-title \"${MP3_TITLE}\" --mp3-artist \"${MP3_ARTIST}\" --mp3-album \"${MP3_ALBUM}\""

PASS_ARGS+=" ${SCRIPT_ARGS}"
PASS_ARGS+=" --output-bitrate '${OUTPUT_BIT_RATE}'"
PASS_ARGS+=" ${PASS_ARGS_MP3}"

# --- Main Logic ---
CHUNK_BASE_PATH="${TEMP_DIR}/chunk"
mkdir -p "${CHUNK_BASE_PATH}"
PROC_CHUNK_DIR="${TEMP_DIR}/processed"
mkdir -p "${PROC_CHUNK_DIR}"

# Stage 1: Split
echo -e "${C_CYAN}--- Stage 1: Splitting audio (preserving channels)... ---${C_RESET}"
SPLIT_CMD="ffmpeg -hide_banner -y -i \"$IN_FILE_ABS\" -f segment -segment_time 300 -c pcm_s16le \"${CHUNK_BASE_PATH}_%04d.wav\""
if [ "${IS_DRY_RUN}" = false ]; then
	eval  "${SPLIT_CMD}" || {
		echo "${C_RED}Error: Failed to split audio file.${C_RESET}"
		exit 1
	}
	if  [ -z "$(ls -A "${TEMP_DIR}" | grep 'chunk_.*.wav')" ]; then
		echo -e "${C_RED}Error: Splitting produced no chunk files.${C_RESET}"
		exit 1
	fi
else
	echo  "[DRY-RUN] Would execute: ${SPLIT_CMD}"
fi

# Stage 2: Process
echo -e "\n${C_CYAN}--- Stage 2: Processing CHUNKS_LIST... ---${C_RESET}"
if [[ "$MAX_JOBS" -le 1 ]]; then
	echo -e "${C_YELLOW}Mode: Serial (1 job at a time)...${C_RESET}"
else
	echo -e "${C_YELLOW}Mode: Parallel (up to $MAX_JOBS concurrent jobs)...${C_RESET}"
fi

## Chunks List List
CHUNKS_LIST=("$CHUNK_BASE_PATH"_*.wav)
for CHUNK_FILE in "${CHUNKS_LIST[@]}"; do
	CHUNK_BASENAME=$( basename "$CHUNK_FILE")
	CHUNK_SUCCESS_FILE="$PROC_CHUNK_DIR/${CHUNK_BASENAME}.success"
	if  [ -f "$CHUNK_SUCCESS_FILE" ]; then
		echo   -e "${C_GREEN}Skipping already completed chunk: $CHUNK_BASENAME${C_RESET}"
		continue
	fi
	(
		CHUNK_SCRIPT_START_TIME=$(  date +%s)
		CHUNK_LOG_FILE="$PROC_CHUNK_DIR/${CHUNK_BASENAME}.log"
		chunk_PASS_ARGS="${PASS_ARGS} --log-file \"$CHUNK_LOG_FILE\""
		PROC_CMD="\"${SCRIPT_DIR}/lib/_process-chunk.sh\" -i \"${CHUNK_FILE}\" -o \"${PROC_CHUNK_DIR}\" ${chunk_PASS_ARGS}"

		if   [ "$IS_DRY_RUN" = true ]; then
			echo    "[DRY-RUN] Would execute for ${CHUNK_BASENAME}"
			touch    "${CHUNK_SUCCESS_FILE}"
		else
			if  eval "$PROC_CMD"; then
				touch     "${CHUNK_SUCCESS_FILE}"
				chunk_SCRIPT_END_TIME=$(    date +%s)
				duration=$((chunk_SCRIPT_END_TIME - CHUNK_SCRIPT_START_TIME))
				echo     -e "${C_GREEN}[SUCCESS]${C_RESET} Processed ${CHUNK_BASENAME} in ${duration}s"
			else
				touch     "$PROC_CHUNK_DIR/${CHUNK_BASENAME}.failure"
				echo     -e "${C_RED}[FAILURE]${C_RESET} Failed to process ${CHUNK_BASENAME}. See details in ${CHUNK_LOG_FILE}"
			fi
		fi
	) &
	if  [[ "${MAX_JOBS}" -gt 1 ]] && [[ $(jobs -p | wc -l) -ge ${MAX_JOBS} ]]; then wait -n; fi
done
wait
echo -e "${C_GREEN}All processing jobs have finished.${C_RESET}"


if [ "$IS_DRY_RUN" = true ]; then
	echo  "Dry run complete. Exiting."
	trap  - EXIT
	cleanup
	exit  0
fi

# Stage 3: Reassemble
echo -e "\n${C_CYAN}--- Stage 3: Assembling final audio & log... ---${C_RESET}"
TEMP_FILE_LIST="$TEMP_DIR/concat_list.txt"

find "$PROC_CHUNK_DIR" -type f \( -name '*.mp3' -o -name '*_btr.mp3' \) | sort | while read -r f; do echo "file '$f'" >>"$TEMP_FILE_LIST"; done

if [ ! -s "$TEMP_FILE_LIST" ]; then
	echo  -e "${C_RED}Error: No processed files found to reassemble.${C_RESET}"
	SHOULD_CLEANUP=false
	exit  1
fi

REASS_CMD="ffmpeg -hide_banner -y -f concat -safe 0 -i \"$TEMP_FILE_LIST\" -c:a libmp3lame $OUTPUT_BIT_RATE \"$OUT_FILE_PATH\""

eval "${REASS_CMD}" || {
	echo  "${C_RED}Error: Failed to reassemble CHUNKS_LIST.${C_RESET}"
	SHOULD_CLEANUP=false
	exit  1
}

# Assemble the final log file
find "$PROC_CHUNK_DIR" -name "*.log" | sort | xargs -I {} cat {} >>"$LOGFILE_PATH"

# Cleanup
cleanup
# --- Final Summary Report ---
SCRIPT_END_TIME=$(date +%s)
SCRIPT_DUR_SEC=$((SCRIPT_END_TIME - SCRIPT_START_TIME))
SCRIPT_DUR_H=$(date -u -d @"$SCRIPT_DUR_SEC" +'%M minutes and %S seconds')
AUDIO_DUR_HH=$(date -u -d @"${AUDIO_DUR_SEC%.*}" +'%H hours, %M minutes and %S seconds')
PROC_SPEED=$( echo "scale=1; ${AUDIO_DUR_SEC} / ${SCRIPT_DUR_SEC}" | bc)

# Display the final summary report to the console
echo -e ""
echo -e "${C_GREEN}${C_BOLD}========================================${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}      Processing Complete!              ${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}========================================${C_RESET}"
echo -e "${C_CYAN}\tLog:${C_RESET}\t\t ${LOGFILE_PATH}"
echo -e "${C_CYAN}\tDuration:${C_RESET}\t ${SCRIPT_DUR_H}"
echo -e "${C_CYAN}\tSpeed:${C_RESET}\t ${PROC_SPEED}"
echo -e "---"
echo -e "${C_CYAN}Input File:${C_RESET}\t\t ${IN_FILE_ABS}"
echo -e "${C_CYAN}\tDuration:${C_RESET}\t ${AUDIO_DUR_HH}"
echo -e "---"
echo -e "${C_CYAN}Output File:${C_RESET}\t ${OUT_FILE_PATH}"
echo -e "${C_CYAN}\tDuration:${C_RESET}\t ${AUDIO_DUR_HH}"
echo -e "---"
echo -e "${C_GREEN}${C_BOLD}========================================${C_RESET}"
