import time
import subprocess
import requests
import logging
import sys
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

INBOX = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/Brain/Inbox"
MEETINGS = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/Brain/Meetings"
WHISPER_MODEL = "medium.en"
OLLAMA_MODEL = "llama3"
OLLAMA_URL = "http://localhost:11434/api/generate"
AUDIO_EXTENSIONS = {".m4a", ".mp3", ".wav", ".mp4"}
WHISPER_TMP = Path("/tmp/whisper_out")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


def wait_for_file(path: Path, stable_secs: int = 2) -> bool:
    """Wait until file size stops changing (iCloud may still be writing)."""
    try:
        size_before = path.stat().st_size
        time.sleep(stable_secs)
        return path.stat().st_size == size_before
    except FileNotFoundError:
        return False


def ensure_ollama() -> None:
    try:
        requests.get("http://localhost:11434", timeout=2)
    except requests.ConnectionError:
        log.info("Starting Ollama...")
        subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(4)


def transcribe(audio_path: Path) -> str:
    WHISPER_TMP.mkdir(exist_ok=True)
    log.info(f"Transcribing {audio_path.name}...")
    result = subprocess.run(
        [
            "whisper", str(audio_path),
            "--model", WHISPER_MODEL,
            "--output_format", "txt",
            "--output_dir", str(WHISPER_TMP),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Whisper failed: {result.stderr}")
    transcript_path = WHISPER_TMP / (audio_path.stem + ".txt")
    return transcript_path.read_text().strip()


def summarize(transcript: str) -> str:
    log.info("Summarizing with Ollama...")
    prompt = (
        "You are a meeting assistant. Given the transcript below, produce a markdown response with exactly three sections:\n\n"
        "### Summary\n"
        "2-4 sentence overview of what was discussed.\n\n"
        "### Action Items\n"
        "Bullet list using [ ] checkboxes. If none, write 'None identified.'\n\n"
        "### Key Decisions\n"
        "Bullet list of decisions made. If none, write 'None identified.'\n\n"
        f"Transcript:\n{transcript}"
    )
    response = requests.post(
        OLLAMA_URL,
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=120,
    )
    response.raise_for_status()
    return response.json()["response"].strip()


def create_note(audio_path: Path, transcript: str, summary: str) -> Path:
    MEETINGS.mkdir(parents=True, exist_ok=True)
    date = datetime.now().strftime("%Y-%m-%d")
    note_path = MEETINGS / f"{date}-{audio_path.stem}.md"
    note_path.write_text(
        f"## {date} — {audio_path.stem}\n\n"
        f"{summary}\n\n"
        f"---\n\n"
        f"### Full Transcript\n\n"
        f"{transcript}\n"
    )
    log.info(f"Note created: {note_path.name}")
    return note_path


def process(audio_path: Path) -> None:
    log.info(f"Processing: {audio_path.name}")
    if not wait_for_file(audio_path):
        log.warning(f"File disappeared before processing: {audio_path}")
        return
    try:
        ensure_ollama()
        transcript = transcribe(audio_path)
        summary = summarize(transcript)
        create_note(audio_path, transcript, summary)
        audio_path.unlink()
        log.info("Done. Audio file removed.")
    except Exception as e:
        log.error(f"Failed to process {audio_path.name}: {e}")
        log.error("Audio file kept for retry.")


class AudioHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() in AUDIO_EXTENSIONS:
            time.sleep(3)  # brief pause for iCloud to finish writing
            process(path)


def main():
    INBOX.mkdir(parents=True, exist_ok=True)
    log.info(f"Watching {INBOX}")
    observer = Observer()
    observer.schedule(AudioHandler(), str(INBOX), recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
