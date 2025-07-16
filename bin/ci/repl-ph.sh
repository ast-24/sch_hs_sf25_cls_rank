#!/bin/bash

SRF_ORIGIN="${X_PH_ORIGIN_SRF}"
ASS_ORIGIN="${X_PH_ORIGIN_ASS}"
API_ORIGIN="${X_PH_ORIGIN_API}"

TARGET_EXTENSIONS=("html" "css" "mjs" "js")

EXCLUDE_DIRS=("node_modules")

CURRENT_DIR=$(pwd)

echo "Starting placeholder replacement in: $CURRENT_DIR"
echo "SRF_ORIGIN: $SRF_ORIGIN"
echo "ASS_ORIGIN: $ASS_ORIGIN"
echo "API_ORIGIN: $API_ORIGIN"
echo ""

processed_count=0

for ext in "${TARGET_EXTENSIONS[@]}"; do
    echo "Processing .$ext files..."

    FIND_PRUNE=""
    for exdir in "${EXCLUDE_DIRS[@]}"; do
        FIND_PRUNE+="-path '*/$exdir/*' -prune -o "
    done
    FIND_PRUNE+="-type d -name '.*' -prune -o "

    eval "find \"$CURRENT_DIR\" $FIND_PRUNE -type f -name '*.$ext' -not -name '.*' -print" | while read -r file; do
        echo "  Processing: $file"

        if grep -q "{{SRF_ORIGIN}}\|{{ASS_ORIGIN}}\|{{API_ORIGIN}}" "$file"; then
            temp_file=$(mktemp)

            sed \
                -e "s|{{SRF_ORIGIN}}|$SRF_ORIGIN|g" \
                -e "s|{{ASS_ORIGIN}}|$ASS_ORIGIN|g" \
                -e "s|{{API_ORIGIN}}|$API_ORIGIN|g" \
                "$file" > "$temp_file"

            mv "$temp_file" "$file"

            echo "    ✓ Replaced placeholders in: $file"
            ((processed_count++))
        else
            echo "    - No placeholders found in: $file"
        fi
    done
done

echo ""
echo "Replacement completed. Processed $processed_count files."