/**
 * freeformLayout.ts — Smart Semantic Freeform Blackboard Positioning Engine with Multi-Panel Division.
 * 
 * Features:
 * 1. Responsive Multi-Panel Division:
 *    - 1 Column: Normal mobile (portrait, W < 768px)
 *    - 2 Columns: Mobile lecture mode (landscape) or Desktop with side panel open (W < 1280px)
 *    - 3 Columns: Desktop fullscreen wide canvas (W >= 1280px)
 * 2. Accurate DOM-calibrated Bounding Box Estimation (prevents unsightly vertical gaps)
 * 3. Step-aware Column Assignment (Step 0 in Col 0, Step 1 in Col 1, Step 2+ in Col 2)
 * 4. Organic Chalk Visuals (hand-drawn tilt, natural handwriting flow)
 */

export interface SemanticBoardElement {
  id: string;
  kind: 'heading' | 'subtopic' | 'definition' | 'bullet_list' | 'table' | 'flowchart' | 'equation' | 'step' | 'code' | 'diagram' | 'text' | 'scratchpad' | 'asset' | 'scatter' | 'plot' | string;
  role?: 'heading' | 'primary_stream' | 'annotation' | 'margin' | 'focal_diagram' | string;
  content: string;
  step_num?: number;
  w?: number;
  h?: number;
  spatial_intent?: {
    target_id?: string;
    rel?: 'below' | 'right_of' | 'above' | 'callout' | 'margin';
    zone?: 'main' | 'margin' | 'focal';
    offset_x?: number;
    offset_y?: number;
  } | null;
  appear_at?: number;
}

export interface PlacedChalkElement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tilt: number; // organic rotation (-1.2deg to +1.2deg)
  kind: string;
  role: string;
  content: string;
  step_num?: number;
  appear_at?: number;
  column_idx?: number;
}

export interface ChalkCurvedConnection {
  fromId: string;
  toId: string;
  path: string;
  label?: string;
  arrowHead: { x: number; y: number };
}

export interface ChalkOverlayData {
  id: string;
  target_node_id: string;
  overlay_type: 'encircle' | 'strikethrough' | 'box' | 'underline' | 'curly_brace' | string;
  sub_term?: string;
  color?: string;
}

export class FreeformBlackboardEngine {
  private canvasWidth: number;
  private canvasHeight: number;
  private placed: Map<string, PlacedChalkElement> = new Map();
  private connections: ChalkCurvedConnection[] = [];
  private isLectureMode = false;

  constructor(canvasWidth = 1000, canvasHeight = 650) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  public setCanvasDimensions(w: number, h: number) {
    this.canvasWidth = w;
    this.canvasHeight = h;
  }

  public setLectureMode(lecture: boolean) {
    this.isLectureMode = lecture;
  }

  /**
   * Determine the number of blackboard column panels based on viewport and mode:
   * - Normal mobile (portrait, W < 768px): 1 Column
   * - Mobile lecture mode (landscape) OR Desktop with sidebar open: 2 Columns
   * - Desktop fullscreen (W >= 1280px): 3 Columns
   */
  public getColumnCount(): number {
    const isMobilePortrait = this.canvasWidth < 768 && !this.isLectureMode;
    if (isMobilePortrait) {
      return 1;
    }
    if (this.isLectureMode || this.canvasWidth < 1280) {
      return 2;
    }
    return 3;
  }

  /**
   * Get the left X offset and width for a column index.
   */
  public getColumnBounds(colIndex: number): { x: number; w: number } {
    const numCols = this.getColumnCount();
    const pad = this.canvasWidth < 768 ? 14 : 20;
    const colGap = numCols === 3 ? 20 : 24;
    const totalGaps = (numCols - 1) * colGap;
    const colW = Math.max(220, Math.floor((this.canvasWidth - 2 * pad - totalGaps) / numCols));
    const safeCol = Math.max(0, Math.min(numCols - 1, colIndex));
    const x = pad + safeCol * (colW + colGap);
    return { x, w: colW };
  }

  /**
   * Get X positions for vertical blackboard seam dividers.
   */
  public getColumnDividers(): number[] {
    const numCols = this.getColumnCount();
    if (numCols <= 1) return [];

    const pad = this.canvasWidth < 768 ? 14 : 20;
    const colGap = numCols === 3 ? 20 : 24;
    const totalGaps = (numCols - 1) * colGap;
    const colW = Math.max(220, Math.floor((this.canvasWidth - 2 * pad - totalGaps) / numCols));

    const dividers: number[] = [];
    for (let i = 0; i < numCols - 1; i++) {
      const dividerX = pad + (i + 1) * colW + i * colGap + Math.floor(colGap / 2);
      dividers.push(dividerX);
    }
    return dividers;
  }

  /**
   * Estimate text and component bounding box with accurate DOM-calibrated line counting.
   */
  private estimateBox(
    content: string,
    kind: string,
    role?: string,
    explicitW?: number,
    explicitH?: number,
    colWidth?: number
  ): { w: number; h: number } {
    const defaultMaxW = colWidth || (this.canvasWidth < 768 ? this.canvasWidth - 28 : 420);

    if (explicitW && explicitH && (kind === 'diagram' || kind === 'scatter' || kind === 'plot' || kind === 'asset')) {
      const pxW = explicitW <= 100 ? (explicitW / 100) * this.canvasWidth : explicitW;
      const pxH = explicitH <= 100 ? (explicitH / 100) * this.canvasHeight : explicitH;
      return { w: Math.min(defaultMaxW, Math.round(pxW)), h: Math.round(pxH) };
    }

    const cleanContent = (content || "").replace(/\\n/g, '\n').trim();
    const lines = cleanContent.split('\n');
    const isMobile = this.canvasWidth < 768;

    // Heading: Top banner within column
    if (kind === 'heading' || role === 'heading' || kind === 'topic') {
      const headingW = defaultMaxW;
      const charsPerLine = Math.max(14, Math.floor(headingW / (isMobile ? 11 : 12.5)));
      let wrapCount = 0;
      for (const line of lines) {
        wrapCount += Math.max(1, Math.ceil(line.length / charsPerLine));
      }
      return {
        w: headingW,
        h: Math.max(32, wrapCount * (isMobile ? 26 : 24) + 8),
      };
    }

    if (kind === 'subtopic') {
      return {
        w: defaultMaxW,
        h: Math.max(28, lines.length * 22 + 6),
      };
    }

    if (kind === 'equation') {
      const hasComplexMath = /\\(?:frac|sqrt|begin|int|sum|pm|cdot|times|left|right)\b|\$\$/.test(cleanContent);
      const mathHeightPerLine = hasComplexMath ? 32 : 24;
      return {
        w: defaultMaxW,
        h: Math.max(30, lines.length * mathHeightPerLine + 10),
      };
    }

    if (kind === 'table' || kind === 'diagram' || kind === 'flowchart' || kind === 'asset' || kind === 'scatter' || kind === 'plot') {
      const diagW = defaultMaxW;
      const lineCount = lines.filter((l) => l.trim().length > 0).length;
      const diagH = Math.min(
        Math.floor(this.canvasHeight * 0.55),
        Math.max(140, lineCount * 24 + 40)
      );
      return { w: diagW, h: diagH };
    }

    if (kind === 'bullet_list') {
      // Bullet list items with Tailwind padding (list-disc pl-5 space-y-1.5)
      const bulletItems = lines.filter((l) => l.trim().length > 0);
      const charsPerLine = Math.max(16, Math.floor((defaultMaxW - 28) / (isMobile ? 8.2 : 9.0)));
      let totalHeight = 6;
      for (const item of bulletItems) {
        const cleanItem = item.replace(/^[-*•\d.]\s*/, '').trim();
        const linesForItem = Math.max(1, Math.ceil(cleanItem.length / charsPerLine));
        // Each bullet: line height (~20px) + inter-bullet spacing (~6px)
        totalHeight += linesForItem * 20 + 6;
      }
      return {
        w: defaultMaxW,
        h: Math.max(30, totalHeight),
      };
    }

    // Definition or standard explanation text
    const charsPerLine = Math.max(16, Math.floor((defaultMaxW - 16) / (isMobile ? 8.2 : 9.0)));
    let wrapCount = 0;
    for (const line of lines) {
      wrapCount += Math.max(1, Math.ceil(line.length / charsPerLine));
    }
    const isDefinition = kind === 'definition';
    const extraPad = isDefinition ? 16 : 8;
    return {
      w: defaultMaxW,
      h: Math.max(26, wrapCount * (isMobile ? 21 : 19) + extraPad),
    };
  }

  /**
   * Assign a node to a blackboard column based on turn/step index and column heights.
   */
  private assignColumn(
    node: SemanticBoardElement,
    numCols: number,
    colHeights: number[]
  ): number {
    if (numCols <= 1) return 0;

    // Heading sits atop Column 0
    if (node.kind === 'heading' || node.role === 'heading' || node.kind === 'topic') {
      return 0;
    }

    // Step-based layout partitioning:
    // Step 0 -> Col 0 (Foundation / Overview)
    // Step 1 -> Col 1 (Derivation / Core Work / Table)
    // Step 2+ -> Col 2 (if 3 cols, else Col 1)
    const stepNum = node.step_num ?? 0;
    let targetCol = 0;
    if (numCols === 2) {
      targetCol = stepNum >= 1 ? 1 : 0;
    } else if (numCols === 3) {
      if (stepNum === 0) targetCol = 0;
      else if (stepNum === 1) targetCol = 1;
      else targetCol = 2;
    }

    // Scratchpad notes or margin callouts go to rightmost column
    if (node.kind === 'scratchpad' || node.role === 'margin') {
      targetCol = numCols - 1;
    }

    // Rollover: If column has filled past 80% canvas height, roll into next column
    const maxColumnHeight = Math.max(500, this.canvasHeight - 50);
    if (colHeights[targetCol] > maxColumnHeight && targetCol < numCols - 1) {
      targetCol += 1;
    }

    return targetCol;
  }

  public placeElement(
    el: SemanticBoardElement,
    colIndex: number,
    currentColY: number
  ): PlacedChalkElement {
    const { id, content, kind, role = 'primary_stream', step_num } = el;
    const colBounds = this.getColumnBounds(colIndex);
    const { w, h } = this.estimateBox(content, kind, role, el.w, el.h, colBounds.w);

    const isHeading = kind === 'heading' || role === 'heading' || kind === 'topic';
    const verticalGap = isHeading ? 14 : 10;
    const yPos = currentColY === 16 ? 16 : currentColY + verticalGap;

    // Organic hand-drawn chalk tilt (-1.1deg to +1.1deg)
    const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const tilt = ((hash % 23) - 11) / 10;

    const finalPlaced: PlacedChalkElement = {
      id,
      x: colBounds.x,
      y: yPos,
      w: colBounds.w,
      h,
      tilt,
      kind,
      role,
      content,
      step_num,
      appear_at: el.appear_at,
      column_idx: colIndex,
    };

    this.placed.set(id, finalPlaced);
    return finalPlaced;
  }

  public layoutAll(nodes: SemanticBoardElement[]): Map<string, PlacedChalkElement> {
    this.placed.clear();
    this.connections = [];

    const numCols = this.getColumnCount();
    // Track Y cursor per column panel, initialized to comfortable top padding (16px)
    const colHeights = Array(numCols).fill(16);

    for (const node of nodes) {
      const colIdx = this.assignColumn(node, numCols, colHeights);
      const placed = this.placeElement(node, colIdx, colHeights[colIdx]);
      colHeights[colIdx] = placed.y + placed.h;
    }

    return this.placed;
  }

  public addCurvedChalkArrow(_fromId: string, _toId: string, _label = ''): ChalkCurvedConnection | null {
    return null;
  }

  public getPlaced(id: string): PlacedChalkElement | undefined {
    return this.placed.get(id);
  }

  public getCanvasHeight(): number {
    let maxY = 550;
    for (const [_, el] of this.placed) {
      maxY = Math.max(maxY, el.y + el.h + 30);
    }
    return Math.max(this.canvasHeight, maxY);
  }
}
