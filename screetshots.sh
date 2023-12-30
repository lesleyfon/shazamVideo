#!/bin/bash

# Input video file
input_file="input.mp4"

# Output directory to store screenshots
output_directory="screenshots/"
# output_directory_inverted="screenshots-inverted/"

# Remove the output directory if it exists
if [ -d "$output_directory" ]; then
    rm -rf "$output_directory"
fi

# Create the output directory if it doesn't exist
mkdir -p "$output_directory"
# mkdir -p "$output_directory_inverted"

# Duration of the video
# duration=$(ffprobe -i "$input_file" -show_entries format=duration -v quiet -of csv="p=0")
duration=$(ffprobe -i "$input_file" -show_entries format=duration -v quiet -of csv="p=0" | awk '{print int($1+0.5)}')

echo "Video duration: $duration seconds"

# # Loop through the video and take screenshots every 2 seconds
for ((timestamp = 1; timestamp <= duration; timestamp += 1)); do

    # Adjusting MM and HH when the conditions are met
    mm=$((timestamp % 60))
    hh=$((timestamp / 60))

    if ((mm == (duration - 2) % 60)); then
        mm="01"
    fi
    behaviorial = ''
    if ((hh == ((duration - 2) / 60) - 2)); then
        hh="01"
    fi

    # pad 0 to the left of the timestamp if it is less than 100 seconds
    # if ((timestamp < 100)); then
    #     timestamp=$(printf "%03d" "$timestamp")
    # fi

    # Formatting the timestamp for ffmpeg
    formatted_timestamp=$(printf "%02d:%02d:%02d" 0 "$hh" "$mm")
    image_name="${output_directory}screenshot-${timestamp}s.jpg"

    # Take the screenshot while scalling down the image to 800px width
    # ffmpeg -ss "$formatted_timestamp" -i "$input_file" -vf "scale=800:-1" -vframes 1 "${output_directory}screenshot-${timestamp}s.jpg"

    # Take the screenshot without scalling down the image
    # ffmpeg -ss "$formatted_timestamp" -i "$input_file" -vframes 1 "${output_directory}screenshot-${timestamp}s.jpg"

    # Invert the image dir
    # inverted_image_name="${output_directory_inverted}screenshot-${timestamp}s-inverted.jpg"

    # ffmpeg -i "$inverted_image_name" -vf "crop=in_w-300:in_h:x=135" "$inverted_image_name"
    # Create a variable to padd 2 zeros to the left if the timestamp is less than 10 seconds and padd 1 zero if the timestamp is less than 100 seconds else no padd

    if ((timestamp < 10)); then
        image_new_name=$(printf "%03d" "$timestamp")
    elif ((timestamp < 100)); then
        image_new_name=$(printf "%03d" "$timestamp")
    else
        image_new_name=$(printf "%d" "$timestamp")
    fi

    ffmpeg -ss "$formatted_timestamp" -i "$input_file" -vf "negate,crop=in_w-285:in_h:x=230" -vframes 1 "${output_directory}${image_new_name}s.jpg"

    # ffmpeg -i "$image_name" -vf "negate,crop=in_w-150:in_h:x=130" "$inverted_image_name"
done

echo "Screenshots captured at 2-second intervals."

# Crop Image using ffmpeg
# From the top left corner of the image, crop 100 pixels horizontally and 160 pixels vertically
# From the top right conner of the image, crop 260 pixels horizontally and 160 pixels vertically
# ffmpeg -i input.png -vf  "crop=100:160:0:0, crop=260:160:0:0" input_crop.png

# ffmpeg -i screenshots-inverted/screenshot-2s-inverted.jpg -vf "crop=in_w-150:in_h:x=100" output_image.jpg

# Invert Image using ffmpeg

# ffmpeg -i output_image.jpg -vf negate output-ffmpeg-inverted.jpg
