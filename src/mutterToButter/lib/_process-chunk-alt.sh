#!/bin/bash

################################################################################
#
# Divortio Audio Cleaner - Core Processor
#
# Version: 5.4 - Bulletproof Calculations & Filter Chain
#
# Description:
# This version replaces 'bc' with 'awk' for all floating-point calculations
# and uses a robust 'printf' method to build the filter chain, definitively
# solving all parsing and syntax errors.
#
################################################################################

# --- Usage and Help Function ---
usage() {
	echo  "This is an internal script and not meant for direct execution."
	echo  "Please use the main 'clean-audio.sh' script."
	exit  1
}

# --- Argument Parsing ---
input_file=""
output_dir=""
log_file=""
output_format="mp3"
output_bitrate_flag="-q:a 5" # Default to HIGH
run_demucs=false
run_mastering=true
run_gate=true
run_polish=true
loudness_target="-19" # Default loudness
mp3_title=""
mp3_artist=""
mp3_album=""
mp3_date=""

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
			output_format="$2"
			shift
			shift
			;;
		--output-bitrate)
			output_bitrate_flag="$2"
			shift
			shift
			;;
		-d | --demucs)
			run_demucs=true
			shift
			;;
		-m | --mastering)
			run_mastering=true
			shift
			;;
		-g | --gate)
			run_gate=true
			shift
			;;
		-c | --clarity-boost)
			run_polish=true
			shift
			;;                                             # Alias for --polish
		--polish)
			run_polish=true
			shift
			;;
		--loudness)
			loudness_target="$2"
			shift
			shift
			;;
		--quality-high)
			output_bitrate_flag="-q:a 5"
			shift
			;;
		--quality-medium)
			output_bitrate_flag="-q:a 7"
			shift
			;;
		--quality-low)
			output_bitrate_flag="-q:a 9"
			shift
			;;
		--mp3-title)
			mp3_title="$2"
			shift
			shift
			;;
		--mp3-artist)
			mp3_artist="$2"
			shift
			shift
			;;
		--mp3-album)
			mp3_album="$2"
			shift
			shift
			;;
		--mp3-date)
			mp3_date="$2"
			shift
			shift
			;;
		-h | --help) usage ;;
		*)
			echo     "Error: Unknown option '$1' in worker script"
			exit                                                         1
			;;
	esac
done

# --- Helper function for logging ---
log_message() {
	if    [[ -n "$log_file" ]]; then
		echo       -e "$1" | sed 's/\x1b\[[0-9;]*m//g' >>"$log_file"
	fi
}

# --- Main Processing Logic ---
set -e
ffmpeg_input_file="$input_file"
base_name=$(basename "${input_file%.*}")

if [ "$run_demucs" = true ]; then
	if    ! command -v demucs &>/dev/null; then
		log_message       "ERROR: 'demucs' command not found. The AI extension is not installed."
		exit       1
	fi
	demucs_command="demucs --model htdemucs_ft --two-stems=vocals -o \"$output_dir\" \"$input_file\""
	log_message    "[CHUNK: $base_name | Demucs Command]\n$demucs_command"
	eval    $demucs_command >/dev/null 2>&1 || {
		log_message                                             "ERROR: Demucs separation failed."
		exit                                                                                             1
	}
	demucs_vocals_path="$output_dir/htdemucs_ft/$base_name/vocals.wav"
	if    [ -f "$demucs_vocals_path" ]; then
		ffmpeg_input_file="$demucs_vocals_path"
	else
		log_message       "ERROR: Demucs output 'vocals.wav' not found."
		exit       1
	fi
fi

# --- SINGLE-PASS AUDIO PROCESSING ---
log_message "\n[CHUNK: $base_name | Building unified filter chain...]"
filter_chain=()

# 1. Add Initial Cleanup Filters
filter_chain+=("highpass=f=80")
filter_chain+=("afftdn=nf=-25")
filter_chain+=("deesser")

# 2. Perform Loudness Analysis & Add Loudnorm Filter
pass1_command="ffmpeg -hide_banner -i \"${ffmpeg_input_file}\" -af \"loudnorm=I=${loudness_target}:TP=-1.5:LRA=11:print_format=json\" -f null -"
pass1_output=$(eval "${pass1_command}" 2>&1) || {
	log_message                                              "ERROR: Loudness analysis failed."
	exit                                                                                              1
}
measured_i=$(echo "$pass1_output" | grep '"input_i"' | awk -F ':' '{print $2}' | tr -d ' ",')
if [ -z "$measured_i" ]; then
	log_message                              "ERROR: Could not parse loudness data."
	exit                                                                                   1
fi
measured_tp=$(echo "$pass1_output" | grep '"input_tp"' | awk -F ':' '{print $2}' | tr -d ' ",')
measured_lra=$(echo "$pass1_output" | grep '"input_lra"' | awk -F ':' '{print $2}' | tr -d ' ",')
measured_thresh=$(echo "$pass1_output" | grep '"input_thresh"' | awk -F ':' '{print $2}' | tr -d ' ",')
target_offset=$(echo "$pass1_output" | grep '"target_offset"' | awk -F ':' '{print $2}' | tr -d ' ",')
filter_chain+=("loudnorm=I=$loudness_target:TP=-1.5:LRA=11:measured_I=$measured_i:measured_TP=$measured_tp:measured_LRA=$measured_lra:measured_thresh=$measured_thresh:offset=$target_offset")

log_message "  - Loudness filter configured for I=${loudness_target} LUFS."

# 3. Conditionally Add Mastering Filters
if [ "$run_mastering" = true ]; then
	temp_stats_log_file="${output_dir}/temp_stats_${base_name}.log"
	analysis_command="ffmpeg -hide_banner -i \"$ffmpeg_input_file\" -af astats=metadata=1,ametadata=mode=print:file=\"$temp_stats_log_file\" -f null -"
	eval    $analysis_command &>/dev/null || {
		log_message                                           "ERROR: Mastering analysis failed."
		exit                                                                                            1
	}

	rms_level_db=$(   grep "Overall.RMS_level" "$temp_stats_log_file" | head -n 1 | awk -F'=' '{print $2}')
	rm    "$temp_stats_log_file"

	if    [ -n "$rms_level_db" ]; then
		if       [ "$run_gate" = true ]; then
			gate_threshold_db=$(         awk "BEGIN {print $rms_level_db - 18}")
			gate_threshold_linear=$(         awk "BEGIN {print 10**($gate_threshold_db/20)}")
			filter_chain+=("agate=threshold=$gate_threshold_linear")
			log_message          "  - Mastering: Dynamic gate enabled."
		fi
		demud_threshold=$(      awk "BEGIN {print $rms_level_db + 3}")
		filter_chain+=("adynamiceq=f=350:w=200:p=2.0:t=$demud_threshold")
		filter_chain+=("adynamiceq=f=7000:w=2000:p=3.0:t=-22")
		filter_chain+=("alimiter=limit=-1.5:level=off")
		log_message    "  - Mastering: Dynamic EQ and Limiter enabled."
	fi
fi

# 4. Conditionally Add Polish Filters
if [ "$run_polish" = true ]; then
	filter_chain+=("superequalizer=2b=1:4b=1:14b=1.5")
	filter_chain+=("asoftclip=type=atan")
	log_message    "  - Polish: Tonal EQ and Soft Clipper enabled."
fi

# 5. Join the filter chain array using the robust printf method.
final_filter_chain=$(printf ",%s" "${filter_chain[@]}")
final_filter_chain=${final_filter_chain:1} # Remove the leading comma

# 6. Execute the single, final ffmpeg command.
final_output_path="$output_dir/${base_name}.$output_format"
metadata_flags="-metadata title=\"$mp3_title\" -metadata artist=\"$mp3_artist\" -metadata album=\"$mp3_album\" -metadata date=\"$mp3_date\""
final_command="ffmpeg -hide_banner -i \"$ffmpeg_input_file\" -af \"$final_filter_chain\" -c:a libmp3lame $output_bitrate_flag $metadata_flags \"$final_output_path\""

log_message "\n[CHUNK: $base_name | Final Optimized Command]\n$final_command"
eval $final_command || {
	log_message                         "ERROR: Final processing command failed."
	exit                                                                                1
}

# Clean up the demucs folder if it was created
if [ "$run_demucs" = true ] && [ "$ffmpeg_input_file" != "$input_file" ]; then
	rm    -r "$(dirname "$ffmpeg_input_file")"
fi

exit 0
