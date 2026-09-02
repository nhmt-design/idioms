#!/usr/bin/env sh

set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
reward_dir="$project_root/public/assets/rewards"
font_file="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

if ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick 'convert' is required to prepare the gold cards." >&2
  exit 1
fi

if [ ! -f "$font_file" ]; then
  echo "Missing number-label font: $font_file" >&2
  exit 1
fi

number=71
while [ "$number" -le 138 ]; do
  theme_index=$(( (number - 71) % 5 + 1 ))
  source_file="$reward_dir/gold-card-0${theme_index}.png"
  output_file="$reward_dir/${number}.jpg"
  padded_number=$(printf "%03d" "$number")

  if [ ! -f "$source_file" ]; then
    echo "Missing approved gold-card source: $source_file" >&2
    exit 1
  fi

  convert "$source_file" \
    -fill '#07152E' \
    -stroke '#F4D27A' \
    -strokewidth 4 \
    -draw 'roundrectangle 28,28 286,100 24,24' \
    -font "$font_file" \
    -pointsize 38 \
    -fill '#FFF8E8' \
    -stroke none \
    -gravity NorthWest \
    -annotate +48+43 "NHHS $padded_number" \
    -strip \
    -interlace Plane \
    -quality 88 \
    "$output_file"

  number=$((number + 1))
done

node "$project_root/scripts/write-gold-card-manifest.mjs"
echo "Prepared 68 numbered gold cards for idioms 71–138 from the five approved designs."
