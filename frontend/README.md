# guiEDTeach (Guidey) Frontend

This is the Next.js 14 frontend application for **guiEDTeach (Guidey)**.

For full system architecture, backend setup, and competitive analysis, refer to the [Root README](../README.md).

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000/tutor](http://localhost:3000/tutor).

## Key Frontend Architecture
- `src/app/tutor/page.tsx`: Core interactive whiteboard tutoring workspace.
- `src/components/tutor/Whiteboard.tsx`: Chalkboard canvas with Rough.js hand-drawn overlays and KaTeX math rendering.
- `src/components/tutor/Avatar3D.tsx`: Embodied 3D WebGL professor avatar with gestures and lip-sync.
- `src/utils/freeformLayout.ts`: Spatial layout engine for dynamic node placement on the board.
