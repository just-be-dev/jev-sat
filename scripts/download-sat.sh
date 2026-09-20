#!/usr/bin/env bash
set -euo pipefail

download_dir="$(mktemp -d)"
trap 'rm -rf "$download_dir"' EXIT

for practice_test in {4..11}; do
  for suffix in digital answers-digital; do
    filename="sat-practice-test-${practice_test}-${suffix}.pdf"
    url="https://satsuite.collegeboard.org/media/pdf/${filename}"
    printf 'Downloading %s\n' "$url"
    curl --fail --location --retry 3 --silent --show-error "$url" --output "$download_dir/$filename"
    pdfinfo "$download_dir/$filename" >/dev/null
  done
done

for file in "$download_dir"/*.pdf; do
  mv "$file" resources/
done

printf 'Downloaded and validated SAT Practice Tests 4–11 and their answer keys.\n'
