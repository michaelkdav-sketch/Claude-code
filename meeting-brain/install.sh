#!/bin/bash
set -e

SCRIPT_DIR="$HOME/scripts/meeting-brain"
PLIST="$HOME/Library/LaunchAgents/com.meetingbrain.watcher.plist"
INBOX="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Brain/Inbox"
MEETINGS="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Brain/Meetings"

echo "==> Installing Meeting Brain"

# Homebrew
if ! command -v brew &>/dev/null; then
    echo "==> Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

echo "==> Installing system dependencies..."
brew install openai-whisper ffmpeg ollama

echo "==> Installing Python dependencies..."
pip3 install watchdog requests

echo "==> Starting Ollama and pulling llama3..."
brew services start ollama
sleep 4
ollama pull llama3

echo "==> Creating vault folders..."
mkdir -p "$INBOX"
mkdir -p "$MEETINGS"

echo "==> Installing watcher script..."
mkdir -p "$SCRIPT_DIR"
cp "$(dirname "$0")/watcher.py" "$SCRIPT_DIR/watcher.py"

PYTHON=$(which python3)

echo "==> Writing launchd plist..."
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.meetingbrain.watcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$SCRIPT_DIR/watcher.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/meetingbrain.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/meetingbrain.error.log</string>
</dict>
</plist>
EOF

echo "==> Loading background service..."
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
echo "Done. Meeting Brain is running."
echo ""
echo "Next steps:"
echo "  1. Open Shortcuts on your iPhone"
echo "  2. Create a shortcut: Record Audio → Save File → iCloud Drive/Brain/Inbox/Meeting-[Date].m4a"
echo "  3. Add it to your home screen"
echo ""
echo "To verify it's running:"
echo "  launchctl list | grep meetingbrain"
echo ""
echo "To watch live logs:"
echo "  tail -f /tmp/meetingbrain.log"
echo ""
echo "To test: drop any .m4a file into:"
echo "  $INBOX"
