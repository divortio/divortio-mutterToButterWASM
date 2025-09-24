#!/bin/bash

################################################################################
#
# Divortio Audio Stats
#
# Version: 1.9
#
# Description:
# Accepts an input audio file and returns various datapoints from OS stat and
# ffprobe in JSON, CSV, or TSV format. Returns null for missing values.
#
################################################################################

# --- Usage and Help Function ---
usage() {
  echo "Usage: $0 <input_file> [options]"
  echo
  echo "Required:"
  echo "  <input_file>              Path to the input audio/video file (as the first argument)."
  echo "  -i, --input      <path>   Alternatively, specify the input file with this flag."
  echo
  echo "Output Options:"
  echo "  -o, --output     <path>   Optional. Save output to a file in addition to the console."
  echo "  --append-file    <path>   Optional. Append output to a file in a stream-friendly format."
  echo "  -f, --format     <format> Output format. Values: json, csv, tsv. (Default: json)"
  echo "  --json-lines              Output in JSON Lines (NDJSON) format. (Default: pretty-printed)"
  echo "  --no-header               Disable the header row for CSV and TSV formats."
  echo "  -h, --help                Display this help message and exit."
  exit 1
}

# --- Argument Parsing ---
input_file=""
output_file=""
append_file_path=""
output_format="json"
show_header=true
json_lines=false

# Check for a positional argument for the input file before parsing flags.
if [[ -n "$1" && "$1" != -* ]]; then
  input_file="$1"
  shift # Consume the argument
fi

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
  -i | --input)
    input_file="$2"
    shift 2
    ;;
  -o | --output)
    output_file="$2"
    shift 2
    ;;
  --append-file)
    append_file_path="$2"
    shift 2
    ;;
  -f | --format)
    output_format=$(echo "$2" | tr '[:upper:]' '[:lower:]')
    shift 2
    ;;
  --no-header)
    show_header=false
    shift
    ;;
  --json-lines)
    json_lines=true
    shift
    ;;
  -h | --help)
    usage
    ;;
  *)
    echo "Error: Unknown option '$1'" >&2
    usage
    ;;
  esac
done

# --- Validation ---
if [[ -z "$input_file" ]]; then
  echo "Error: Input file is required." >&2
  usage
fi
if [ ! -f "$input_file" ]; then
  echo "Error: Input file not found at '$input_file'" >&2
  exit 1
fi

# Check for dependencies
for cmd in ffprobe stat date bc jq tee; do
  if ! command -v $cmd &>/dev/null; then
    echo "Error: Required command '$cmd' is not found. Please install it." >&2
    exit 1
  fi
done
# Explicitly check that at least one MD5 utility is available
if ! command -v md5sum &>/dev/null && ! command -v md5 &>/dev/null; then
  echo "Error: Required command 'md5sum' or 'md5' is not found. Please install one." >&2
  exit 1
fi

# --- Helper Functions ---
get_file_md5() {
  if command -v md5sum &>/dev/null; then
    md5sum "$1" | awk '{print $1}'
  elif command -v md5 &>/dev/null; then
    md5 -q "$1"
  else
    echo "" # Return empty string on failure
  fi
}

# --- Data Gathering ---
filename=$(basename "$input_file")
probeDate=$(date +%s%3N)

# ffprobe: Get duration in seconds, then convert
duration_s=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input_file" 2>/dev/null)
if [[ -n "$duration_s" ]]; then
  duration=$(printf "%.0f" "$(echo "$duration_s * 1000" | bc)")
  durationH=$(date -u -d @"${duration_s%.*}" +'%H:%M:%S')
else
  duration=""
  durationH=""
fi

# md5: Get file hash
md5=$(get_file_md5 "$input_file")

# stat & date: Handle GNU (Linux) vs BSD (macOS) differences for cross-platform compatibility
if stat --version &>/dev/null; then # GNU tools (Linux)
  bytes=$(stat -c %s "$input_file")
  modDate_s=$(stat -c %Y "$input_file")
  createDate_s=$(stat -c %W "$input_file")

  # Use GNU 'date -d' to format timestamps
  probeDateH=$(date -u -d @"$modDate_s" +'%Y-%m-%dT%H:%M:%SZ')
  modDateH=$(date -u -d @"$modDate_s" +'%Y-%m-%dT%H:%M:%SZ')
  if [[ "$createDate_s" -ne 0 ]]; then
    createDateH=$(date -u -d @"$createDate_s" +'%Y-%m-%dT%H:%M:%SZ')
  else
    createDateH=""
  fi
else # BSD tools (macOS)
  bytes=$(stat -f %z "$input_file")
  modDate_s=$(stat -f %m "$input_file")
  createDate_s=$(stat -f %B "$input_file")

  # Use BSD 'date -r' to format timestamps
  probeDateH=$(date -u -r "${probeDate::-3}" +'%Y-%m-%dT%H:%M:%SZ')
  modDateH=$(date -u -r "$modDate_s" +'%Y-%m-%dT%H:%M:%SZ')
  if [[ "$createDate_s" -ne 0 ]]; then
    createDateH=$(date -u -r "$createDate_s" +'%Y-%m-%dT%H:%M:%SZ')
  else
    createDateH=""
  fi
fi

bytesH=$(echo "$bytes" | awk '{
    split("B KB MB GB TB PB", a);
    i=1;
    while($1>1024){
        $1/=1024;
        i++;
    }
    printf "%.1f%s\n", $1, a[i];
}')

modDate=$((modDate_s * 1000))

if [[ "$createDate_s" -ne 0 ]]; then
  createDate=$((createDate_s * 1000))
else
  createDate=""
fi

# --- Output Generation ---
final_output=""
data_line="" # Will be used for CSV/TSV append
case "$output_format" in
json)
  jq_filter='.'
  if [ "$json_lines" = true ]; then
    jq_filter='-c'
  fi
  # Use --arg to safely pass all shell vars. jq handles conversion to null/number.
  final_output=$(jq -n \
    --arg filename "$filename" \
    --arg durationH "$durationH" \
    --arg bytesH "$bytesH" \
    --arg createDateH "$createDateH" \
    --arg md5 "$md5" \
    --arg modDateH "$modDateH" \
    --arg modDate "$modDate" \
    --arg createDate "$createDate" \
    --arg bytes "$bytes" \
    --arg duration "$duration" \
    --arg probeDate "$probeDate" \
    --arg probeDateH "$probeDateH" \
    '
    # Helper to convert empty strings from shell to JSON null
    def tonull: if . == "" then null else . end;
    # Helper to convert numeric strings to numbers, or empty to null
    def tonum: if . == "" then null else tonumber end;
    {
      "filename": $filename,
      "durationH": ($durationH | tonull),
      "bytesH": ($bytesH | tonull),
      "createDateH": ($createDateH | tonull),
      "md5": ($md5 | tonull),
      "modDateH": ($modDateH | tonull),
      "modDate": ($modDate | tonum),
      "createDate": ($createDate | tonum),
      "bytes": ($bytes | tonum),
      "duration": ($duration | tonum),
      "probeDate": ($probeDate | tonum),
      "probeDateH": ($probeDateH | tonull)
    }
    ' $jq_filter)
  ;;
csv | tsv)
  delimiter=","
  if [ "$output_format" == "tsv" ]; then
    delimiter=$'\t'
  fi

  header_line=""
  if [ "$show_header" = true ]; then
    header=("filename" "durationH" "bytesH" "createDateH" "md5" "modDateH" "modDate" "createDate" "bytes" "duration" "probeDate" "probeDateH")
    header_line=$(
      IFS="$delimiter"
      echo "${header[*]}"
    )
  fi

  data=("$filename" "$durationH" "$bytesH" "$createDateH" "$md5" "$modDateH" "$modDate" "$createDate" "$bytes" "$duration" "$probeDate" "$probeDateH")
  data_line=$(
    IFS="$delimiter"
    echo "${data[*]}"
  )

  if [[ -n "$header_line" ]]; then
    final_output="${header_line}\n${data_line}"
  else
    final_output="$data_line"
  fi
  ;;
*)
  echo "Error: Invalid output format '$output_format'. Use 'json', 'csv', or 'tsv'." >&2
  exit 1
  ;;
esac

# --- Delivery to Console and/or Output File ---
if [[ -n "$output_file" ]]; then
  # Create directory path if it doesn't exist
  mkdir -p "$(dirname "$output_file")"
  # Use tee to print to stdout and write to the file
  echo -e "$final_output" | tee "$output_file"
else
  # Just print to stdout as normal
  echo -e "$final_output"
fi

# --- Append to File (if specified) ---
if [[ -n "$append_file_path" ]]; then
  append_output=""
  case "$output_format" in
  json)
    # For appending, ALWAYS use compact JSON Lines format
    append_output=$(echo "$final_output" | jq -c '.')
    ;;
  csv | tsv)
    # For appending, ALWAYS use the data line without a header
    append_output="$data_line"
    ;;
  esac

  # Create directory path and append to the file
  mkdir -p "$(dirname "$append_file_path")"
  echo "$append_output" >>"$append_file_path"
fi

exit 0
