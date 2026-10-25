import os
from pathlib import Path

# Load .env file manually if it exists in the root directory
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip()
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                os.environ.setdefault(key, val)
                os.environ[key] = val

# LM Studio Models (for LM Studio server at http://localhost:1234/v1/chat/completions)
LS_MODELS = [
    "HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive",
    "THUDM/glm-4-9b-chat",
]

# Ollama Models (for Ollama server at http://localhost:11434/api/generate)
OLLAMA_MODELS = ["gpt-oss:120b","gemma4:31b-cloud","devstral-small-2:24b-cloud"]
OLLAMA_MODEL="gpt-oss:120b"

# HF Models (backup local models, only used when no remote is available)
HF_MODELS = ["Qwen/Qwen2.5-72B-Instruct"]

# LLM Provider Configuration
LLM_PROVIDER = "ollama"
LLM_PROVIDER_ORDER = [ "lmstudio", "ollama","hf", "local"]  # Prefer HF/LM Studio over Ollama


# TTS/STT Configuration
TTS_PROVIDER = "piper"
STT_PROVIDER = "whisper"
MELO_LANGUAGE = "EN"
MELO_SPEAKER = "EN_INDIA"
MELO_SPEED = 1.0

PIPER_BIN = str(Path(__file__).parent.parent / "tools" / "piper_bin" / "piper.exe")
PIPER_MODEL_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx"
PIPER_MODEL_PATH = "memory/tts/piper/model.onnx"
PIPER_CONFIG_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"
PIPER_CONFIG_PATH = "memory/tts/piper/model.json"

VOSK_MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.15.zip"
VOSK_MODEL_PATH = "memory/stt/vosk/model"
VOSK_SAMPLE_RATE = 16000
WHISPER_MODEL_NAME = "base"

AGENT_MEMORY_ROOT = Path("agent_memory")
ENV_CACHE_FILE = AGENT_MEMORY_ROOT / "termux_env.json"

# --- Pedagogical and Board Layout Configuration ---
DEFAULT_CANVAS_WIDTH = int(os.environ.get("DEFAULT_CANVAS_WIDTH", 1000))
DEFAULT_CANVAS_HEIGHT = int(os.environ.get("DEFAULT_CANVAS_HEIGHT", 650))
MAX_ACTIVE_BOARD_NODES = int(os.environ.get("MAX_ACTIVE_BOARD_NODES", 8))
PRUNE_BOARD_NODES_COUNT = int(os.environ.get("PRUNE_BOARD_NODES_COUNT", 4))
DEFAULT_OVERLAY_COLOR = os.environ.get("DEFAULT_OVERLAY_COLOR", "chalk-yellow")
DEFAULT_CONNECTION_STYLE = os.environ.get("DEFAULT_CONNECTION_STYLE", "curved_callout")

# --- Classifier Thresholds and Boost Weights ---
CLASSIFIER_KEYWORD_BOOST = float(os.environ.get("CLASSIFIER_KEYWORD_BOOST", 0.35))
CLASSIFIER_MECHANISM_BOOST = float(os.environ.get("CLASSIFIER_MECHANISM_BOOST", 0.40))
CLASSIFIER_HIGH_CONFIDENCE_OVERRIDE = float(os.environ.get("CLASSIFIER_HIGH_CONFIDENCE_OVERRIDE", 0.88))
CLASSIFIER_MEDIUM_CONFIDENCE_OVERRIDE = float(os.environ.get("CLASSIFIER_MEDIUM_CONFIDENCE_OVERRIDE", 0.70))
CLASSIFIER_MIN_SCORE_THRESHOLD = float(os.environ.get("CLASSIFIER_MIN_SCORE_THRESHOLD", 0.10))

