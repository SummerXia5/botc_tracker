#!/bin/bash
# Download Blood on the Clocktower character icons from the official wiki
# Usage: bash download_icons.sh

ICON_DIR="/Users/xiasummer/血染钟楼/client/public/icons"
mkdir -p "$ICON_DIR"

CHARACTERS=(
  washerwoman librarian investigator chef empath fortune_teller
  undertaker monk ravenkeeper virgin slayer soldier mayor
  butler drunk recluse saint
  poisoner spy scarlet_woman baron imp
  grandmother sailor chambermaid exorcist innkeeper gambler
  gossip courtier professor minstrel tea_lady pacifist
  fool tinker moonchild goon lunatic
  godfather devils_advocate assassin mastermind
  zombuul pukka shabaloth po
  clockmaker dreamer snake_charmer mathematician flowergirl
  town_crier oracle savant seamstress philosopher artist juggler sage
  mutant sweetheart barber klutz
  evil_twin witch cerenovus pit_hag
  fang_gu vigormortis no_dashii vortox
  acrobat amnesiac bounty_hunter cannibal choirboy cult_leader
  engineer fisherman general huntsman king knight lycanthrope
  magician nightwatchman pixie preacher plague_doctor puzzlemaster
  alchemist balloonist banshee boneCollector deviant harlot
  heretic judge matron voudon
  damsel golem heretic politician snitch sweetheart
  boomdandy fearmonger goblin marionette mezepheles psychopath
  widow organ_grinder
  al_hadikhia fang_gu lleech lil_monsta legion lord_of_typhon
  riot shabaloth vigormortis vortox yaggababble
)

echo "Downloading ${#CHARACTERS[@]} character icons..."

for char in "${CHARACTERS[@]}"; do
  # Convert underscore IDs to wiki format (capitalize each word, no underscores for some)
  WIKI_NAME=$(echo "$char" | sed 's/_//g')
  FILE="$ICON_DIR/${char}.png"
  
  if [ -f "$FILE" ]; then
    echo "  SKIP: $char (already exists)"
    continue
  fi
  
  # Try the wiki File page to find the actual image URL
  PAGE_URL="https://wiki.bloodontheclocktower.com/File:Icon_${WIKI_NAME}.png"
  
  # Extract the actual image path from the file page
  IMG_PATH=$(curl -s "$PAGE_URL" | grep -o '/images/[^"]*Icon_[^"]*\.png' | head -1)
  
  if [ -n "$IMG_PATH" ]; then
    FULL_URL="https://wiki.bloodontheclocktower.com${IMG_PATH}"
    echo "  GET: $char → $FULL_URL"
    curl -sL -o "$FILE" "$FULL_URL"
    
    # Check if file is valid (at least 1KB)
    FILE_SIZE=$(wc -c < "$FILE" 2>/dev/null || echo 0)
    if [ "$FILE_SIZE" -lt 1000 ]; then
      echo "  WARN: $char seems too small (${FILE_SIZE}B), removing"
      rm -f "$FILE"
    fi
  else
    echo "  MISS: $char (no image found on wiki)"
  fi
  
  # Be polite to the wiki server
  sleep 0.3
done

echo ""
echo "Done! Downloaded icons to $ICON_DIR"
ls -la "$ICON_DIR" | tail -5
echo "Total: $(ls "$ICON_DIR"/*.png 2>/dev/null | wc -l) icons"
