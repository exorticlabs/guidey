<div align="center">

# Guidey: The Open-Source Socratic AI Tutor

**An open-source, interactive AI tutor that helps you think and solve problems yourself, instead of just handing you the answers.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Demo-guidey.exortic.com-emerald.svg)](https://guidey.exortic.com)
[![Issues](https://img.shields.io/github/issues/exorticlabs/guidey)](https://github.com/exorticlabs/guidey/issues)
[![Stars](https://img.shields.io/github/stars/exorticlabs/guidey)](https://github.com/exorticlabs/guidey/stargazers)

<br/>

<video src="assets/promo1.mp4" controls autoplay loop muted playsinline style="max-height:560px; border-radius:12px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);"></video>

<p><em>Watch Guidey pace lessons in real-time on a digital blackboard with LaTeX typesetting and progressive hints.</em></p>

[**Try Live Demo (No Signup Required)**](https://guidey.exortic.com) · [**Explore Open Issues**](https://github.com/exorticlabs/guidey/issues) · [**Join Discussions**](https://github.com/exorticlabs/guidey/discussions)

</div>

---

## 💡 The Problem with Modern AI "Tutors"

Most AI tutoring tools are just thin prompt wrappers over generic LLMs. You ask a question, and they immediately dump 5 paragraphs of the final answer or solve your entire assignment for you.

**The result is cognitive decay**: students and engineers submit code and homework they do not understand, bypassing the struggle where actual learning happens.

**Guidey fixes that by acting like an experienced professor sitting next to you:**
* **Progressive Socratic Scaffolding**: It diagnoses your frontier of knowledge and provides small, targeted hints instead of spoiling the solution.
* **Anti-Monologue Guardrails**: Keeps responses concise and conversational, asking you probing questions to guide your next step.
* **Interactive Digital Blackboard**: Renders hand-drawn procedural chalk margins (Rough.js), LaTeX math typesetting (KaTeX), and interactive visual simulators.
* **Embodied 3D Instructor**: Three.js GLTF-driven professor avatar with synchronized gestures, gaze tracking, and real-time speech narration.
* **100% Free & Open Source**: Full-stack Next.js 14 frontend + FastAPI backend. Run it locally or self-host without proprietary vendor lock-in.

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

## 🚀 Key Features & Implementation

### 1. Unified Socratic Agent (`backend/agent/core/`)
* **Archetype & Pedagogical Classifier (`pedagogical_classifier.py`)**: Dynamically classifies learner intent into archetypes (Conceptual, Procedural, Diagnostic, Exam Prep, Troubleshooting) to modulate tone, hint depth, and board pacing.
* **Semantic Board Specification**: In a single pass, the professor agent outputs structured JSON specifying:
  * Speech segments for progressive narration.
  * Board layout elements (`heading`, `body`, `margin`, `scratchpad`).
  * Procedural chalk overlays (`encircle`, `strikethrough`, `box`, `highlight`, `underline`).
  * Curved Bézier arrows linking interdependent concepts.
* **Active Comprehension Probes**: Embeds diagnostic check-ins and checks your understanding before advancing to higher-order topics.

### 2. Frontend Whiteboard & Visual Layer (`frontend/src/components/tutor/`)
* **Chalkboard Themes (`Whiteboard.tsx`)**: Procedural blackboard styles in **Emerald**, **Slate**, and **Ocean** powered by **Rough.js**.
* **Native KaTeX LaTeX Support**: Crisp rendering of mathematical equations, derivations, matrices, and notation ($$\int_a^b f(x)dx$$, $$\sum_{i=1}^n x_i$$).
* **3D Embodied Avatar (`Avatar3D.tsx`)**: Three.js GLTF avatar with gesture switching, coordinate pointing, and responsive posture.
* **Direct Concept Simulators**: Interactive sandbox components allowing learners to manipulate parameters and test hypotheses.

---

## ⚙️ Quickstart (Run Locally in 2 Minutes)

### Prerequisites
* **Python 3.10+**
* **Node.js 18+** & `npm`
* An API key for Google Gemini, OpenAI, or Ollama

### Option A: Windows 1-Click Launch
```cmd
start.bat
```

### Option B: Manual Setup

#### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env # Add your API key
uvicorn server:app --reload --host 127.0.0.1 --port 8000
```
Backend API will be live at `http://localhost:8000` (Swagger docs: `http://localhost:8000/docs`).

#### 2. Frontend (Next.js 14)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000/tutor](http://localhost:3000/tutor) in your browser.

---

## 🤝 Contributing & Good First Issues

We welcome contributions from developers, educators, and researchers of all experience levels! 

Check out our curated issue backlog:
* **[Good First Issues](https://github.com/exorticlabs/guidey/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)**: Beginner-friendly tickets to get started.
* **[Help Wanted](https://github.com/exorticlabs/guidey/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)**: Feature requests and architecture enhancements.

Key areas currently open:
- **Issue #4**: Pluggable multi-provider LLM abstraction layer (Ollama, vLLM, Groq).
- **Issue #5**: Dynamic model selection and custom LLM parameter controls.
- **Issue #11**: Responsive blackboard viewport layout and mobile touch support.
- **Issue #12**: Modular service refactoring for session management.
- **Issue #10**: Infinite blackboard canvas and procedural scientific diagrams.

Read our [Contributing Guide](https://github.com/exorticlabs/guidey/blob/main/CONTRIBUTING.md) to submit your first Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free for personal, academic, and commercial use.
