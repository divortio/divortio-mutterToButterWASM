#!/bin/bash

################################################################################
#
# Divortio Audio Cleaner - Core Processor
#
# Version: 6.1 - Final (Stable)
#
# Description:
# The internal core processing engine. It is called by the main script for
# each audio chunk and is not intended for direct user execution.
#
################################################################################

# --- Configuration Variables ---
# --- These values can be tuned to adjust the audio processing characteristics.

# Loudness Normalization (EBU R 128)
TARGET_LOUDNESS_LUFS="-14"    # Integrated Loudness Target in LUFS
TARGET_TRUE_PEAK_DBFS="-1.0"  # Max True Peak in dBFS
TARGET_LOUDNESS_RANGE_LU="11" # Loudness Range Target in LU

# Core Cleanup Filters
HIGH_PASS_FREQ_HZ="80"     # Frequency for the high-pass filter to remove rumble.
NOISE_FLOOR_DBFS="-25"     # Noise floor for the spectral noise reduction filter (afftdn).

# --- Argument Parsing ---
input_file=""
output_dir=""
log_file=""

OUTPUT_FORMAT="mp3"
OUTPUT_BITRATE="-q:a 9"

RUN_GATE=true
RUN_CLARITY_BOOST=true
RUN_TONAL_EQ=true
RUN_SOFT_CLIP=true

MP3_TITLE=""
MP3_ARTIST=""
MP3_ALBUM=""
MP3_ALBUM_ARTIST=""
MP3_GENRE=""
MP3_COMMENT=""
MP3_DATE=""

# --- Helper function for logging ---
log_message() {
	if  [[ -n "$log_file" ]]; then
		echo   -e "$1" | sed 's/\x1b\[[0-9;]*m//g' >>"$log_file"
	fi
}

# --- Usage and Help Function ---
usage() {
	echo  "This is an internal script and not meant for direct execution."
	echo  "Please use the main 'clean-audio.sh' script."
	exit  1
}

while [[ $# -gt 0 ]]; do
	key="$1"
	case $key in
		-i | --input)
			input_file="$2"
			shift
			shift
			;;
		-o | --output)
			output_dir="$2"
			shift
			shift
			;;
		--log-file)
			log_file="$2"
			shift
			shift
			;;
		--output-format)
			OUTPUT_FORMAT="$2"
			shift
			shift
			;;
		--output-bitrate)
			OUTPUT_BITRATE="$2"
			shift
			shift
			;;
		-g | --gate)
			RUN_GATE=true
			shift
			;;
		-c | --clarity-boost)
			RUN_CLARITY_BOOST=true
			shift
			;;
		-t | --tonal-eq)
			RUN_TONAL_EQ=true
			shift
			;;
		-s | --soft-clip)
			RUN_SOFT_CLIP=true
			shift
			;;
		--mp3-title)
			MP3_TITLE="$2"
			shift
			shift
			;;
		--mp3-artist)
			MP3_ARTIST="$2"
			shift
			shift
			;;
		--mp3-album-artist)
			MP3_ALBUM_ARTIST="$2"
			shift
			shift
			;;
		--mp3-album)
			MP3_ALBUM="$2"
			shift
			shift
			;;
		--mp3-date)
			MP3_DATE="$2"
			shift
			shift
			;;
		--mp3-genre)
			MP3_GENRE="$2"
			shift
			shift
			;;
		--mp3-comment)
			MP3_COMMENT="$2"
			shift
			shift
			;;
		-h | --help) usage ;;
		*)
			echo  "Error: Unknown option '$1'"
			exit  1
			;;
	esac
done

# --- Main Processing Logic ---
set -e

## Input File
INPUT_FILE="${input_file}"
INPUT_FILE_BASENAME=$(basename "${input_file%.*}")

FILTER1_HP_NF_DEESER="highpass=f=${HIGH_PASS_FREQ_HZ}, afftdn=nf=$NOISE_FLOOR_DBFS, deesser"

# Filter 1: High Pass, Noise Floor, Deesser, Loudness Analysis

# Generate Filter 1
FILTER1_LOUDNESS="${FILTER1_HP_NF_DEESER}, " \
	"loudnorm=I=${TARGET_LOUDNESS_LUFS}:" \
	"TP=${TARGET_TRUE_PEAK_DBFS}:" \
	"LRA=${TARGET_LOUDNESS_RANGE_LU}:"

FILTER1_STR="${FILTER1_HP_NF_DEESER}, ${FILTER1_LOUDNESS}"

log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 1 | Analyze Loudness:][FILTER]\n\t${FILTER1_STR}"

FILTER1_CMD="ffmpeg -hide_banner -y"
FILTER1_CMD+=" -i \"${INPUT_FILE}\""
FILTER1_CMD+=" -af \"${FILTER1_STR}\""
FILTER1_CMD+=" print_format=json -f null -"

log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 1  | Analyze Loudness:][CMD]\n\t${FILTER1_CMD}"
# Execute Filter 1
FILTER1_RESULT=$(eval "${FILTER1_CMD}" 2>&1) || {
	log_message  "ERROR: Loudness analysis ffmpeg command failed."
	exit  1
}

# Validate Filter 1 results
measured_i=$(echo "${FILTER1_RESULT}" | grep '"input_i"' | awk -F ':' '{print $2}' | tr -d ' ",')
if [ -z "$measured_i" ]; then
	log_message  "ERROR: Could not parse loudness data from Pass 1 output."
	exit  1
fi

log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 1  | Analyze Loudness][RESULT]\n\t${FILTER1_RESULT}"

log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 1  | Analyze Loudness][OK]"

## Gather Measurements
measured_tp=$(echo "${FILTER1_RESULT}" | grep '"input_tp"' | awk -F ':' '{print $2}' | tr -d ' ",')
measured_lra=$(echo "${FILTER1_RESULT}" | grep '"input_lra"' | awk -F ':' '{print $2}' | tr -d ' ",')
measured_thresh=$(echo "${FILTER1_RESULT}"  | grep '"input_thresh"' | awk -F ':' '{print $2}' | tr -d ' ",')
target_offset=$(echo "${FILTER1_RESULT}" | grep '"target_offset"' | awk -F ':' '{print $2}' | tr -d ' ",')

## Create Filter 2
FILTER2_LOUDNESS="loudnorm=I=${TARGET_LOUDNESS_LUFS}:" \
	"TP=${TARGET_TRUE_PEAK_DBFS}:" \
	"LRA=${TARGET_LOUDNESS_RANGE_LU}:" \
	"measured_I=${measured_i}:" \
	"measured_TP=${measured_tp}:" \
	"measured_LRA=${measured_lra}:" \
	"measured_thresh=${measured_thresh}:" \
	"offset=$target_offset"
FILTER2_STR="${FILTER1_HP_NF_DEESER}, ${FILTER2_LOUDNESS}"

log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 2 | Apply Loudness Filters][FILTER]\n\t${FILTER2_STR}"

## Temporary Pre-processed chunk with measured & target loudness applied
TEMP_CHUNK_PATH="$output_dir/${INPUT_FILE_BASENAME}_temp.$OUTPUT_FORMAT"

FILTER2_CMD="ffmpeg -hide_banner -y"
FILTER2_CMD+=" -i \"${INPUT_FILE}\""
FILTER2_CMD+=" -i \"$INPUT_FILE\"" \
	FILTER2_CMD+=" -af \"${FILTER2_STR}\"" \
	FILTER2_CMD+=" -c:a libmp3lame ${OUTPUT_BITRATE}" \
	FILTER2_CMD+=" \"${TEMP_CHUNK_PATH}\""
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 2 | Apply Loudness Filters][FILE]\n\t${TEMP_CHUNK_PATH}"
log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 2 | Apply Loudness Filters][CMD]\n\t ${FILTER2_CMD}"

FILTER2_RESULT=$(eval "${FILTER2_CMD}" 2>&1) || {
	log_message  "ERROR: Loudness analysis ffmpeg command failed."
	exit  1
}

log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 2 | Apply Loudness Filters][RESULT]\n\t${FILTER2_RESULT}"
log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 2 | Apply Loudness Filters][FILE]\n\t${TEMP_CHUNK_PATH}"
log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 2 | Apply Loudness Filters][OK]"

### Phase 3: Mastering Analysis
log_message "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 3 | Mastering Analysis]"

# Build Mastering Analysis Filter
FILTER3_ANALYSIS=""
FILTER3_ANALYSIS+="astats=metadata=1,ametadata=mode=print:"
FILTER3_STR="${FILTER3_ANALYSIS}"
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 3 | Mastering Analysis][FILTER]\n\t${FILTER3_STR}"
## Temporary Mastering Stats File
TEMP_STATS_FILE="${output_dir}/temp_stats_${INPUT_FILE_BASENAME}.log"

# Build Mastering Analysis Command
FILTER3_CMD="ffmpeg -hide_banner -y"
FILTER3_CMD+=" -i \"${TEMP_CHUNK_PATH}\""
FILTER3_CMD+=" -af \"${FILTER3_STR}\"" \
	FILTER3_CMD+=" file=\"${TEMP_STATS_FILE}\""
FILTER3_CMD+=" -f null -"
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 3 | Mastering Analysis][CMD]\n\t${FILTER3_CMD}"

# Execute Filter 3: Mastering Analysis
FILTER3_RESULT=$( eval "${FILTER3_CMD}" 2>&1) || {
	log_message    "ERROR: Mastering analysis ffmpeg command failed."
	exit   1
}
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 3 | Mastering Analysis][RESULT]\n\t${FILTER3_RESULT}"

# Check stats file exists
if  [ ! -f "${TEMP_STATS_FILE}" ]; then
	log_message   "ERROR: Mastering analysis stats file not found: '${TEMP_STATS_FILE}'"
	rm    "${TEMP_CHUNK_PATH}"
	exit   1
fi
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 3 | Mastering Analysis][FILE]\n\t${TEMP_STATS_FILE}"
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 3 | Mastering Analysis][OK]"

### Phase 4: RMS Analysis
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 4 | RMS Analysis]"

# Parse RMS Level
RMS_LEVEL_DB=$(   grep "Overall.RMS_level" "${TEMP_STATS_FILE}" | head -n 1 | awk -F'=' '{print $2}')

# Validate RMS Level
if   [ -z "${RMS_LEVEL_DB}" ]; then
	log_message    "ERROR: Could not measure RMS level for mastering from stats file."
	rm   "${TEMP_STATS_FILE}"
	rm   "${TEMP_CHUNK_PATH}"
	exit    1
else
	# Log RMS Level
	log_message   "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 4 | RMS Analysis][OK]\n\tMeasured RMS Level: ${RMS_LEVEL_DB}db"
	rm  "$TEMP_STATS_FILE"
fi

### Phase 5: Build Mastering Filters
log_message     "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5 | Build Master Filters]"
mastering_filters=()

## Phase 5a: Mastering Demud Threshold
log_message     "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5a | Demud Threshold]"
demud_threshold=$(       awk "BEGIN {print ${RMS_LEVEL_DB} + 3}")
log_message   "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5a | Demud Threshold][OK]\n\tCalculated Demud Threshold: ${demud_threshold}dB"
mastering_filters+=("adynamiceq=f=350:w=200:p=2.0:t=$demud_threshold")
mastering_filters+=("adynamiceq=f=7000:w=2000:p=3.0:t=-22")
mastering_filters+=("alimiter=limit=-1.5:level=off")

## Phase 5b: Mastering Gate
if   [ "$RUN_GATE" = true ]; then
	log_message    "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5b | Gate Analysis]"
	gate_threshold_db=$(         awk "BEGIN {print ${RMS_LEVEL_DB}- 18}")
	gate_threshold_linear=$(           awk "BEGIN {print 10**(${gate_threshold_db}/20)}")
	mastering_filters+=("agate=threshold=${gate_threshold_linear}")
	log_message   "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5b | Gate Analysis][OK]\n\tCalculated Gate Threshold: ${gate_threshold_linear} (from ${gate_threshold_db} dB)"
else
	log_message     "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5b | Gate Analysis][SKIPPED]\n\t Gate Analysis SKIPPED, to enable provide argument --gate"
fi

## Phase 5c: Clarity Boost
if [ "${RUN_CLARITY_BOOST}" = true ]; then
	log_message      "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5c | Clarity Boost]"
	mastering_filters+=("equalizer=f=8000:t=h:g=3")
	log_message      "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5c | Clarity Boost][OK]"
else
	log_message     "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5c | Clarity Boost][SKIPPED]\n\t Clarity Boost SKIPPED, to enable provide argument --clarity-boost"
fi

## Phase 5d: Tonal EQ and Soft Clip
if  [ "${RUN_TONAL_EQ}" = true ]; then
	log_message       "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5d | Tonal EQ]"
	mastering_filters+=("superequalizer=2b=1:4b=1:14b=1.5")
	log_message       "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5d | Tonal EQ][OK]"
else
	log_message     "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5d | Tonal EQ][SKIPPED]\n\t Tonal EQ  SKIPPED, to enable provide argument --tonal-eq"
fi

## Phase 5e: Soft Clip
if  [ "${RUN_SOFT_CLIP}" = true ]; then
	log_message       "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5e | Soft Clip]"
	mastering_filters+=("asoftclip=type=atan")
	log_message       "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5e | Soft Clip][OK]"
else
	log_message     "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 5e | Soft Clip][SKIPPED]\n\t Soft Clip  SKIPPED, to enable provide argument --soft-clip"
fi

### Phase 6: Output Mastered File
log_message       "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 6 | Output Mastered File]"

## Expand Mastering Filters
mastering_filters_str=$( printf ",%s" "${mastering_filters_str[@]}")
mastering_filters_str=${mastering_filters_str:1}  # Remove the leading comma
log_message       "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 6 | Output Mastered File][FILTER]\n\t${mastering_filters_str}"

## Build MP3 Metadata Flags
MP3_TAGS=""
# Validate tags
if   [ -n "${MP3_TITLE}" ]; then
	MP3_TAGS+=" -metadata title=\"${MP3_TITLE}\""
fi
if   [ -n "${MP3_ARTIST}" ]; then
	MP3_TAGS+=" -metadata artist=\"${MP3_ARTIST}\""
fi
if   [ -n "${MP3_ALBUM}" ]; then
	MP3_TAGS+=" -metadata album=\"${MP3_ALBUM}\""
fi
if   [ -n "${MP3_ALBUM_ARTIST}" ]; then
	MP3_TAGS+=" -metadata album-artist=\"${MP3_ALBUM_ARTIST}\""
fi
if   [ -n "${MP3_COMMENT}" ]; then
	MP3_TAGS+=" -metadata comment=\"${MP3_COMMENT}\""
fi
if   [ -n "${MP3_GENRE}" ]; then
	MP3_TAGS+=" -metadata genre=\"${MP3_GENRE}\""
fi
if   [ -n "${MP3_DATE}" ]; then
	MP3_TAGS+=" -metadata date=\"${MP3_DATE}\""
fi

# Build Mastering Filter Command
OUTPUT_CHUNK_PATH="$output_dir/${INPUT_FILE_BASENAME}_btr.$OUTPUT_FORMAT"

MASTERING_CMD="ffmpeg -hide_banner -y"
MASTERING_CMD+=" -i \"${TEMP_CHUNK_PATH}\""
MASTERING_CMD+=" -af \"$mastering_filters_str\""
MASTERING_CMD+=" -c:a libmp3lame ${OUTPUT_BITRATE}"
## Include MP3 Tags if any
if   [ -n "${MP3_TAGS}" ]; then
	MASTERING_CMD+=" \"${MP3_TAGS}\""
fi
MASTERING_CMD+=" \"${OUTPUT_CHUNK_PATH}\""

log_message   "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 6 | Output Mastered File][CMD]\n\t${MASTERING_CMD}"

# Execute Master Filter Command
FILTER4_RESULT=$( eval "${MASTERING_CMD}" 2>&1) || {
	log_message     "ERROR: Applying mastering filters failed."
	if  [ ! -f "${TEMP_CHUNK_PATH}" ]; then
		rm     "${TEMP_CHUNK_PATH}"
	fi
	if  [ ! -f "${OUTPUT_CHUNK_PATH}" ]; then
		rm     "${OUTPUT_CHUNK_PATH}"
	fi
	exit   1
}

log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 6 | Output Mastered File][RESULT]\n\t${FILTER4_RESULT}"

# Check Mastered File Exists
if  [ ! -f "${OUTPUT_CHUNK_PATH}" ]; then
	log_message   "ERROR: Mastering filters failed. Output file not found: '${OUTPUT_CHUNK_PATH}'"
	if   [ ! -f "${TEMP_CHUNK_PATH}" ]; then
		rm     "${TEMP_CHUNK_PATH}"
	fi
	exit   1
else
	## Mastered File Output Exists
	log_message   "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 6 | Output Mastered File][FILE]\n\t${OUTPUT_CHUNK_PATH}"
fi

log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Phase 6 | Output Mastered File][OK]"

## COMPLETE
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Complete][OK]"
log_message  "\n[CHUNK: ${INPUT_FILE_BASENAME} | Complete][FILE]: '${OUTPUT_CHUNK_PATH}'"

## Cleanup
if   [ ! -f "${TEMP_CHUNK_PATH}" ]; then
	rm      "${TEMP_CHUNK_PATH}"
fi

exit 0
