"use client";

import React, { useMemo, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows, useGLTF, useAnimations, Html } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { motion } from "framer-motion";

// Reusable math objects to prevent garbage collection leaks in useFrame
const _euler = new THREE.Euler();
const _qTarget = new THREE.Quaternion();
const _qBase = new THREE.Quaternion();
const _qOffset = new THREE.Quaternion();

// Suppress THREE.Clock deprecation warning from R3F internals
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('THREE.Clock: This module has been deprecated')) return;
  originalWarn.apply(console, args);
};

/**
 * DETAILED MAPPING OF MODEL METADATA (RobotExpressive.glb)
 * --------------------------------------------------------
 * MESHES (Rendered Geometry):
 * - 0 Foot.L        - 1 Torso         - 2 Head          - 3 Foot.R
 * - 4 Shoulder.L    - 5 Arm.L         - 6 Shoulder.R    - 7 Arm.R
 * - 8 Leg.L         - 9 LowerLeg.L    - 10 Leg.R        - 11 LowerLeg.R
 * - 12 Hand.R (SkinnedMesh)           - 13 Hand.L (SkinnedMesh)
 * 
 * ANIMATIONS (Built-in full-body clips):
 * - 0 Dance         - 1 Death         - 2 Idle          - 3 Jump
 * - 4 No            - 5 Punch         - 6 Running       - 7 Sitting
 * - 8 Standing      - 9 ThumbsUp      - 10 Walking      - 11 WalkJump
 * - 12 Wave         - 13 Yes
 * 
 * PROCEDURAL ANIMATION USAGE:
 * For detailed custom poses (Thinking, Scolding, etc.), we apply rotational Math 
 * directly to the underlying Skeleton Bones (UpperArm, LowerArm, Hand, Spine, Head), 
 * rather than the rigid Meshes, because parts like 'Hand.R' are SkinnedMeshes 
 * that are deformed exclusively by their internal bones.
 */
export interface Avatar3DProps {
  isSpeaking?: boolean;
  isWriting?: boolean;
  animationState?: 'idle' | 'greeting' | 'scolding' | 'thinking' | 'writing' | 'sorry' | 'walking' | 'pointing';
  positionOffset?: { x: number, y: number }; // percentage offset from right-bottom corner
}

type EulerTarget = { x?: number; y?: number; z?: number };
type PoseMap = Record<string, EulerTarget>;

// Dynamic parts mapping: Define static base poses here for easy tweaking
const PROCEDURAL_POSES: Record<string, PoseMap> = {
  thinking: {
    torso: { x: 0.15, y: -0.10 },
    head: { x: 0.15, y: 0.20, z: 0.05 },
    armL: { x: 0.10, y: 0.60, z: -0.40 },
    forearmL: { x: 1.50, y: -0.60 },
    armR: { x: 1.00, y: -0.40, z: -0.10 },
    forearmR: { x: 2.20, y: -1.20 },
    handR: { x: -0.40, y: 0.20, z: -0.15 }
  },
  scolding: {
    torso: { x: -0.10 },
    armR: { x: 1.20, z: 0.10 },
    forearmR: { x: 0.80, z: -0.20 },
    handR: { x: -0.20 }
  },
  writing: {
    torso: { y: 0.30 },
    head: { x: 0.10 },
    armR: { x: 1.50, z: 0.20 },
    forearmR: { x: 0.50 },
    handR: { x: -0.20 }
  },
  sorry: {
    torso: { x: 0.10, y: -0.10 },
    head: { x: 0.20, y: 0.20 },
    armR: { x: 2.20, z: -0.20 },
    forearmR: { x: 2.00 },
    handR: { x: -0.50 }
  },
  pointing: {
    torso: { y: 0.20 },
    head: { y: -0.40 },
    armR: { x: -0.50, z: 0.50 },
    forearmR: { x: 0.10 },
    handR: { x: 0.10 }
  }
};

const GLBAvatar = ({ isSpeaking, animationState = 'idle' }: Avatar3DProps) => {
  const groupRef = useRef<THREE.Group>(null);

  // Use a reliable, playful cartoon character with built-in animations
  const { scene: rawScene, animations: rawAnimations } = useGLTF("https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/models/gltf/RobotExpressive/RobotExpressive.glb");

  // Create a unique instance of the scene so we don't mutate the globally cached GLTF
  const scene = useMemo(() => SkeletonUtils.clone(rawScene), [rawScene]);

  const { actions } = useAnimations(rawAnimations, scene);

  // Traverse and find exactly the BONES (not meshes) to apply procedural rotations
  const { headNode, torsoNode, armRNode, forearmRNode, handRNode, armLNode, forearmLNode, handLNode, initialQuats } = useMemo(() => {
    console.log("[AvatarDebug] ---- FETCHING EXACT BONES ----");

    let head: any = null, torso: any = null, armR: any = null, forearmR: any = null, handR: any = null, armL: any = null, forearmL: any = null, handL: any = null;

    scene.traverse((child: any) => {
      if (child.isBone) {
        const n = child.name.toLowerCase();

        if (!head && n.includes('head')) head = child;
        if (!torso && (n.includes('spine') || n === 'bone.001')) torso = child;

        const isRight = n.includes('right') || n.includes('_r') || n.includes('.r') || n.endsWith('r');
        const isLeft = n.includes('left') || n.includes('_l') || n.includes('.l') || n.endsWith('l');

        // Match arms robustly (avoiding "armature" root nodes and the 'r' in "arm")
        if (n.includes('arm') && !n.includes('armature')) {
          const isLower = n.includes('lower') || n.includes('fore');
          if (isRight) {
            if (isLower) {
              if (!forearmR) forearmR = child;
            } else {
              if (!armR) armR = child;
            }
          }
          if (isLeft) {
            if (isLower) {
              if (!forearmL) forearmL = child;
            } else {
              if (!armL) armL = child;
            }
          }
        }
        if (n.includes('hand')) {
          if (isRight && !handR) handR = child;
          if (isLeft && !handL) handL = child;
        }
      }

      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    console.log("[AvatarDebug] Matched Bones (These are the actual bones deformed by math):", {
      head: head?.name, torso: torso?.name,
      armR: armR?.name, forearmR: forearmR?.name, handR: handR?.name,
      armL: armL?.name, forearmL: forearmL?.name, handL: handL?.name
    });

    // Save rest quaternions so we don't accumulate procedural rotation errors
    const initialQuats: Record<string, THREE.Quaternion> = {};
    if (head) initialQuats['head'] = head.quaternion.clone();
    if (torso) initialQuats['torso'] = torso.quaternion.clone();

    if (armR) initialQuats['armR'] = armR.quaternion.clone();
    if (forearmR) initialQuats['forearmR'] = forearmR.quaternion.clone();
    if (handR) initialQuats['handR'] = handR.quaternion.clone();

    if (armL) initialQuats['armL'] = armL.quaternion.clone();
    if (forearmL) initialQuats['forearmL'] = forearmL.quaternion.clone();
    if (handL) initialQuats['handL'] = handL.quaternion.clone();

    return {
      headNode: head, torsoNode: torso,
      armRNode: armR, forearmRNode: forearmR, handRNode: handR,
      armLNode: armL, forearmLNode: forearmL, handLNode: handL,
      initialQuats
    };
  }, [scene]);

  const frameCount = useRef(0);

  // Dynamic Sweat Drop
  useEffect(() => {
    if (headNode) {
      const geometry = new THREE.SphereGeometry(0.1, 16, 16);
      geometry.scale(1, 1.5, 1); // teardrop shape
      const material = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.8, roughness: 0.2 });
      const sweatMesh = new THREE.Mesh(geometry, material);
      sweatMesh.name = "SweatDrop";
      sweatMesh.position.set(-0.3, 0.4, 0.3); // right side of forehead
      sweatMesh.scale.setScalar(0); // hide by default
      headNode.add(sweatMesh);
      return () => {
        headNode.remove(sweatMesh);
        geometry.dispose();
        material.dispose();
      };
    }
  }, [headNode]);

  // 2. Play animations synced to state
  const currentAction = useRef<string>('Idle');

  useEffect(() => {
    let nextAction = 'Idle';

    // We use Idle as the base for all our custom animations so the spine continues
    // to breathe organically while our math engine drives the limbs.
    switch (animationState) {
      case 'greeting': nextAction = 'Wave'; break;
      case 'walking': nextAction = 'Walking'; break;
      case 'scolding': nextAction = 'Idle'; break;
      case 'thinking': nextAction = 'Idle'; break;
      case 'writing': nextAction = 'Idle'; break;
      case 'sorry': nextAction = 'Idle'; break;
      case 'pointing': nextAction = 'Idle'; break;
      case 'idle':
      default: nextAction = 'Idle'; break;
    }

    if (currentAction.current !== nextAction && actions[nextAction]) {
      const next = actions[nextAction];
      const curr = actions[currentAction.current];

      if (next) {
        next.reset().play();
        if (curr) {
          curr.crossFadeTo(next, 0.3, true);
        }
      }
      currentAction.current = nextAction;
    }
  }, [animationState, actions]);

  // Procedural Weights for smooth blending
  const weights = useRef({ thinking: 0, scolding: 0, writing: 0, sorry: 0 });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Smoothly rotate character to face the board when writing!
    if (groupRef.current) {
      const targetRotationY = animationState === 'writing' ? Math.PI : 0;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotationY, 5 * delta);
    }

    // Calculate Override Weights (using dynamic fallback for missing keys)
    if (!(weights.current as any).pointing) (weights.current as any).pointing = 0;

    weights.current.thinking = THREE.MathUtils.lerp(weights.current.thinking, animationState === 'thinking' ? 1 : 0, 5 * delta);
    weights.current.scolding = THREE.MathUtils.lerp(weights.current.scolding, animationState === 'scolding' ? 1 : 0, 5 * delta);
    weights.current.writing = THREE.MathUtils.lerp(weights.current.writing, animationState === 'writing' ? 1 : 0, 5 * delta);
    weights.current.sorry = THREE.MathUtils.lerp(weights.current.sorry, animationState === 'sorry' ? 1 : 0, 5 * delta);
    (weights.current as any).pointing = THREE.MathUtils.lerp((weights.current as any).pointing, animationState === 'pointing' ? 1 : 0, 5 * delta);

    // Create a dictionary for calculated active euler targets
    const eulers: Record<string, { x: number, y: number, z: number }> = {
      torso: { x: 0, y: 0, z: 0 },
      head: { x: 0, y: 0, z: 0 },
      armR: { x: 0, y: 0, z: 0 },
      forearmR: { x: 0, y: 0, z: 0 },
      handR: { x: 0, y: 0, z: 0 },
      armL: { x: 0, y: 0, z: 0 },
      forearmL: { x: 0, y: 0, z: 0 },
      handL: { x: 0, y: 0, z: 0 },
    };

    // 1. Apply Dynamic Parts Mapping (Static Pose Values)
    Object.keys(PROCEDURAL_POSES).forEach(state => {
      const w = (weights.current as any)[state] || 0;
      if (w > 0) {
        const pose = PROCEDURAL_POSES[state];
        Object.keys(pose).forEach(part => {
          if (eulers[part]) {
            eulers[part].x += (pose[part].x || 0) * w;
            eulers[part].y += (pose[part].y || 0) * w;
            eulers[part].z += (pose[part].z || 0) * w;
          }
        });
      }
    });

    // 2. Apply Dynamic Time-Based Movements (Sine waves for life/motion)
    if (weights.current.thinking > 0) {
      eulers.handR.y += Math.sin(t * 3) * 0.05 * weights.current.thinking;
    }
    if (weights.current.scolding > 0) {
      eulers.head.y += Math.sin(t * 10) * 0.2 * weights.current.scolding;
      eulers.handR.y += Math.sin(t * 15) * 0.5 * weights.current.scolding;
    }
    if (weights.current.writing > 0) {
      eulers.armR.y += Math.sin(t * 4) * 0.3 * weights.current.writing;
      eulers.handR.x += Math.sin(t * 8) * 0.3 * weights.current.writing;
    }
    if (weights.current.sorry > 0) {
      eulers.handR.y += Math.sin(t * 10) * 0.3 * weights.current.sorry;
      eulers.handR.z += Math.cos(t * 10) * 0.2 * weights.current.sorry;
    }

    // Dynamic Frame Logging of ACTUAL applied movements (throttled to ~1 second)
    frameCount.current++;
    const totalWeight = weights.current.thinking + weights.current.scolding + weights.current.writing + weights.current.sorry + (weights.current as any).pointing;
    if (frameCount.current % 60 === 0 && totalWeight > 0.001) {
      console.groupCollapsed(`[Avatar3D Actual Movement] State: ${animationState}`);
      console.log(`Weights -> Think:${weights.current.thinking.toFixed(2)}, Scold:${weights.current.scolding.toFixed(2)}, Write:${weights.current.writing.toFixed(2)}, Sorry:${weights.current.sorry.toFixed(2)}, Point:${(weights.current as any).pointing.toFixed(2)}`);
      
      Object.keys(eulers).forEach(part => {
        const e = eulers[part];
        if (Math.abs(e.x) > 0.01 || Math.abs(e.y) > 0.01 || Math.abs(e.z) > 0.01) {
          console.log(`- ${part} (Active): Euler(${e.x.toFixed(2)}, ${e.y.toFixed(2)}, ${e.z.toFixed(2)})`);
        }
      });
      console.groupEnd();
    }

    // Apply Relative Offset to nodes (Initial Quat * Offset) to prevent accumulation
    const applyRelative = (node: any, key: string) => {
      if (!node || !initialQuats[key]) return;
      const e = eulers[key];
      _euler.set(e.x, e.y, e.z);
      _qOffset.setFromEuler(_euler);
      _qTarget.copy(initialQuats[key]).multiply(_qOffset);
      node.quaternion.copy(_qTarget);
    };

    applyRelative(torsoNode, 'torso');
    applyRelative(headNode, 'head');
    applyRelative(armRNode, 'armR');
    applyRelative(forearmRNode, 'forearmR');
    applyRelative(handRNode, 'handR');
    applyRelative(armLNode, 'armL');
    applyRelative(forearmLNode, 'forearmL');
    applyRelative(handLNode, 'handL');

    // Animate Sweat Drop
    if (headNode) {
      const sweatMesh = headNode.getObjectByName("SweatDrop") as THREE.Mesh;
      if (sweatMesh) {
        const mat = sweatMesh.material as THREE.MeshStandardMaterial;
        sweatMesh.scale.setScalar(weights.current.sorry);

        // Slide down the face with modulo, but fade opacity to prevent visual popping
        const progress = (t * 0.4) % 0.4;
        sweatMesh.position.y = 0.4 - progress;
        mat.opacity = (1 - (progress / 0.4)) * weights.current.sorry * 0.8;
      }
    }
  });

  // If the robot is too small or big, we adjust here. The robot is naturally quite small.
  return (
    <group ref={groupRef} position={[0, -0.5, 0]} scale={0.2}>
      <primitive object={scene} />
    </group>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      console.error("[Avatar3D] Error boundary caught error:", this.state.error);
      return <div className="text-red-500 bg-white p-2">Error: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}

export default function Avatar3D({ isSpeaking, isWriting, animationState, positionOffset = { x: 0, y: 0 } }: Avatar3DProps) {
  const activeState = animationState || (isWriting ? 'writing' : 'idle');

  return (
    <motion.div
      className="absolute pointer-events-none z-40 w-80 h-[28rem]"
      initial={{ bottom: 0, right: 32 }}
      animate={{
        bottom: `${positionOffset.y}%`,
        right: `calc(2rem + ${positionOffset.x}%)`
      }}
      transition={{ type: "spring", stiffness: 60, damping: 15 }}
    >
      <ErrorBoundary>
        <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [0, -0.2, 2.5], fov: 40 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 2, 2]} intensity={1.5} castShadow />
          <directionalLight position={[-2, 1, -2]} intensity={0.5} />

          <Suspense fallback={<Html center><div className="bg-black/50 text-white p-2 rounded">Loading Model...</div></Html>}>
            <GLBAvatar isSpeaking={isSpeaking} animationState={activeState} />
            <Environment preset="city" />
            <ContactShadows position={[0, -0.5, 0]} opacity={0.5} scale={10} blur={2} far={4} />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </motion.div>
  );
}