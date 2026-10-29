# guiEDTeach (Guidey)

**guiEDTeach** (Guidey) is an open-source, AI-powered interactive tutoring platform designed to deliver personalized, Socratic education through a simulated multimodal digital blackboard. Rather than behaving as a simple chat wrapper, Guidey integrates real-time curriculum management, automated pedagogical pacing, chalkboard rendering with LaTeX support, and an embodied 3D instructor.

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                   Next.js 14 Frontend                       │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   Interactive Tutor   │       │   3D Canvas Avatar    │  │
│  │   Chalkboard (KaTeX)  │       │     (Three.js/GLTF)   │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
│              │                               │              │
│              └───────────────┬───────────────┘              │
│                              │ WebSocket / REST             │
└──────────────────────────────┼──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Backend                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │             Unified Professor Agent                   │  │
│  │  - Pedagogical Intent & Archetype Classifier          │  │
│  │  - Socratic Pacing & Lesson Planner                   │  │
│  │  - Semantic Board Spec & Gesture Emitter              │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│       ┌──────────────────────┼──────────────────────┐       │
│       ▼                      ▼                      ▼       │
│ ┌────────────┐        ┌─────────────┐        ┌────────────┐ │
│ │ Curriculum │        │   Student   │        │ Background │ │
│ │    Hub     │        │ Mastery DB  │        │ TTS Engine │ │
│ └────────────┘        └─────────────┘        └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Current Implementation Status

### 1. Unified Blackboard Professor Agent (`backend/agent/core/`)
* **Unified Pipeline:** Migrated from a fragmented multi-agent orchestrator to a unified, streamlined professor agent (`professor_agent.py`) running Google Gemini / LLM backends.
* **Archetype & Pedagogical Classifier (`pedagogical_classifier.py`):** Dynamically classifies queries into teaching archetypes (Conceptual, Procedural, Socratic Diagnostic, Exam Prep, Troubleshooting) to modulate conversational depth and board layout.
* **Semantic Board Specification:** In a single generation pass, the agent outputs structured JSON specifying:
  * Speech segments for audio narration.
  * Board elements (`heading`, `body`, `margin`, `scratchpad`).
  * Live chalk overlays (`encircle`, `strikethrough`, `box`, `highlight`, `underline`).
  * Curved Bézier chalk connections (`applies here`, `derives from`).
  * Instructor 3D gestures (`pointing`, `explaining`, `thinking`, `celebrating`).
* **Socratic Checks:** Generates embedded comprehension checks and multi-step diagnostic questions before advancing concepts.

### 2. Frontend Whiteboard & Visual Layer (`frontend/src/components/tutor/`)
* **Blackboard Shader & Themes (`Whiteboard.tsx`):**
  * Three chalkboard color palettes: **Emerald**, **Slate**, and **Ocean**.
  * Hand-drawn procedural chalk margins, borders, and overlays powered by **Rough.js**.
* **KaTeX LaTeX Typesetting:**
  * Native mathematical rendering using `rehype-katex` and `remark-math` for clean multi-line equations, integrals, matrices, and notation ($$\frac{df}{dx}$$, $$\sum_{i=1}^n x_i$$).
* **Freeform Dynamic Layout Engine (`freeformLayout.ts`):**
  * Calculates node placement on the fly with collision avoidance, respecting screen dimensions rather than hardcoding static coordinates.
* **Embodied 3D Avatar (`Avatar3D.tsx`):**
  * Three.js GLTF-based animated professor avatar supporting real-time gesture switching, head orientation, and lip-sync state.
* **Chalk Visual Artifacts & Simulators:**
  * `ChalkScatterPlot.tsx`: Coordinate charts with chalkboard-styled data points and regression lines.
  * `ChalkVisualArtifact.tsx`: Interactive cards and sandboxed visual snippets.
  * `ConceptSimulator.tsx`: Parameter manipulation playground for interactive experimentation.
  * `FeedbackModal.tsx`: User feedback and ratings on lesson clarity.

### 3. Data & Session Management (`backend/server.py`)
* **Multi-Turn Chat Sessions:** Persistent learning sessions stored in SQLite/Supabase.
* **Curriculum & Knowledge Extraction:** PDF chunking, syllabus ingestion, and topic dependency trees.
* **Pipelined Audio & TTS:** Background prefetching and progressive audio streaming (`gtts` and Web Speech API).


## 📂 Project Structure

```text
guiedteach/
├── backend/
│   ├── agent/
│   │   ├── core/
│   │   │   ├── professor_agent.py       # Unified LLM professor logic
│   │   │   ├── professor_prompt.py      # System prompts & blackboard schemas
│   │   │   ├── pedagogical_classifier.py # Teaching archetype classifier
│   │   │   ├── lesson_planner.py        # Socratic pacing & curriculum progression
│   │   │   └── state.py                 # Multi-turn conversation state
│   │   └── skills/
│   │       ├── curriculum.py            # Syllabus parsing & dependency graph
│   │       ├── research.py              # Dynamic web and doc retrieval
│   │       └── teaching.py              # Tutor managers & session handlers
│   ├── server.py                        # FastAPI endpoints, WebSockets, & auth
│   └── database.py                      # SQLAlchemy models & database connection
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── tutor/page.tsx           # Main interactive tutor view
│   │   │   └── globals.css              # Global styling & blackboard themes
│   │   ├── components/
│   │   │   ├── tutor/
│   │   │   │   ├── Whiteboard.tsx       # Core chalkboard (Rough.js + KaTeX)
│   │   │   │   ├── Avatar3D.tsx         # Three.js 3D professor avatar
│   │   │   │   ├── ChalkScatterPlot.tsx # Chalk coordinate graphs
│   │   │   │   ├── ChalkVisualArtifact.tsx # Interactive board artifacts
│   │   │   │   ├── ConceptSimulator.tsx # Concept parameter sliders
│   │   │   │   └── UnderstandingCheck.tsx # In-lesson diagnostic quizzes
│   │   │   └── ui/                      # Shared design components
│   │   └── utils/
│   │       ├── freeformLayout.ts        # Physics/collision board layout engine
│   │       └── tts.ts                   # Speech synthesis & segment parsing
│   └── package.json
├── docs/                                # Architectural specifications
└── start.bat                            # Dual-server startup script
```

---

## ⚙️ Getting Started

### Prerequisites
* **Python 3.10+** (with virtual environment in `backend/venv`)
* **Node.js 18+** & `npm`
* Valid API keys for Google Gemini / OpenAI (stored in `backend/.env`)

### Quick Start (Windows)
Run the root startup script to launch both the FastAPI backend and Next.js frontend simultaneously:
```cmd
start.bat
```

### Manual Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # On Windows (or source venv/bin/activate on Unix)
pip install -r requirements.txt
uvicorn server:app --reload --host 127.0.0.1 --port 8000
```
Backend API will be live at `http://localhost:8000` (Docs: `http://localhost:8000/docs`).

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000/tutor` in your browser.

---

## 🎯 Immediate Roadmap & Priorities

1. **Clean UI Overhaul:** Upgrade from prototype styling to a refined design system (consistent glassmorphism, polished dark mode, clean slate finishes).
2. **Dynamic Diagramming Engine:** Introduce procedural SVG/canvas path generation for anatomical, physical, and scientific diagrams (circuits, cells, organic chemistry, optical rays) instead of restricting the board to text and boxes.
3. **High-Precision Pointing & Chalk Tip Animation:** Add an animated chalk cursor that draws strokes and curves in sync with speech, and align the 3D avatar's pointing target with exact screen coordinates.
4. **True Interactive Blackboard Exploration:** Transition concept simulators from isolated cards into full-board, direct-manipulation chalk artifacts where students can drag nodes, tweak graphs, and test hypotheses in place.

---

## 📄 License

This project is open-sourced under the [MIT License](LICENSE).
