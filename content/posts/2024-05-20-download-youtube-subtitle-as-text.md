---
title: use yt-dlp to download youtube subtitle as plain text
date: 2024-05-22T14:07:19+0800
---
# Function to download and process subtitles
download_and_process_subtitles() {
    local video_url="$1"
    local base_filename="$2"

    # Download subtitles using yt-dlp
    yt-dlp --write-auto-subs --sub-format "vtt" --skip-download -o "${base_filename}.%(lang)s.%(ext)s" "$video_url"

    # Find the downloaded subtitle file
    local subtitle_file=$(ls ${base_filename}.*.vtt | head -1)

    # Check if the subtitle file exists
    if [ -f "$subtitle_file" ]; then
        # Process the subtitle file to remove tags, timestamps and duplicate lines
        perl -ne 'print unless /<.*>/ or /^\s*$/ or /-->/' "$subtitle_file" | awk '!seen[$0]++' > "${base_filename}.txt"
        echo "Processed subtitle saved as ${base_filename}.txt"
    else
        echo "No subtitle file found."
    fi
}

# Variables
VIDEO_URL="video url"
BASE_FILENAME="basename"

# Call the function
download_and_process_subtitles "$VIDEO_URL" "$BASE_FILENAME"