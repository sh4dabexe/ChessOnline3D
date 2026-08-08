import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { sqToPos } from './Board3D';

// ── Procedural PBR Texture Generators ───────────────────────────────────────

/** Generates realistic Ivory Marble Texture for White Pieces */
function createMarbleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F5F2EB';
  ctx.fillRect(0, 0, 512, 512);

  ctx.lineWidth = 1.2;
  for (let i = 0; i < 20; i++) {
    ctx.strokeStyle = `rgba(180, 168, 145, ${0.05 + Math.random() * 0.08})`;
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < 512) {
      y += 20 + Math.random() * 25;
      x += (Math.random() - 0.5) * 25;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Generates realistic Golden Oak Wood Texture for Brown Pieces */
function createGoldenOakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#A67B4B';
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 4) {
    const alpha = 0.04 + Math.sin(y * 0.10) * 0.03;
    ctx.fillStyle = `rgba(80, 55, 25, ${alpha})`;
    ctx.fillRect(0, y, 512, 2);
  }

  // Warm golden grain highlights
  for (let y = 0; y < 512; y += 5) {
    const alpha = 0.04 + Math.sin(y * 0.08) * 0.03;
    ctx.fillStyle = `rgba(210, 175, 100, ${alpha})`;
    ctx.fillRect(0, y, 512, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const marbleTexture = createMarbleTexture();
const goldenOakTexture = createGoldenOakTexture();

// ── Materials ─────────────────────────────────────────────────────────────────

// White Piece: Polished Ivory Marble
const WHITE_PIECE_MAT = new THREE.MeshStandardMaterial({
  color: '#F4F0E8',
  map: marbleTexture,
  roughness: 0.08,
  metalness: 0.15,
});

// Brown Piece: Polished Golden Oak
const BLACK_PIECE_MAT = new THREE.MeshStandardMaterial({
  color: '#B8935A',
  map: goldenOakTexture,
  roughness: 0.10,
  metalness: 0.18,
});

// ── Crown Accent Materials ────────────────────────────────────────────────────
// Golden accent for brown (black) pieces - Ultra-shiny metallic gold with clearcoat lacquer
const GOLD_ACCENT_MAT = new THREE.MeshPhysicalMaterial({
  color: '#FFD700',
  metalness: 1.0,
  roughness: 0.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.02,
  reflectivity: 1.0,
  emissive: '#FFB700',
  emissiveIntensity: 0.25,
});

// Ivory/pearl accent for white pieces - Ultra-shiny polished white gold / pearl with clearcoat
const WHITE_ACCENT_MAT = new THREE.MeshPhysicalMaterial({
  color: '#FFFFFF',
  metalness: 0.65,
  roughness: 0.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.01,
  reflectivity: 1.0,
  emissive: '#FFFFFF',
  emissiveIntensity: 0.15,
});

// ── Per-Piece-Type Outline Materials (Inverted Hull) ──────────────────────────
// Clean, smooth outlines via back-face scaled shell — NOT wireframe edges.

const OUTLINE_COLORS: Record<string, { w: string; b: string }> = {
  k: { w: '#2C2418', b: '#F5EDE0' },  // King: Dark / Cream white
  q: { w: '#2A1F2E', b: '#F0E8D8' },  // Queen: Dark / Warm white
  r: { w: '#252830', b: '#EDE5D5' },  // Rook: Dark / Ivory
  b: { w: '#1C2A26', b: '#F2EAD8' },  // Bishop: Dark / Soft white
  n: { w: '#2E2218', b: '#EFE7D6' },  // Knight: Dark / Pearl
  p: { w: '#2A2A2A', b: '#ECE4D4' },  // Pawn: Dark / Off-white
};

function createOutlineHullMaterial(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
  });
}

// Pre-create hull outline materials
const HULL_MATS: Record<string, { w: THREE.MeshBasicMaterial; b: THREE.MeshBasicMaterial }> = {};
for (const [piece, colors] of Object.entries(OUTLINE_COLORS)) {
  HULL_MATS[piece] = {
    w: createOutlineHullMaterial(colors.w),
    b: createOutlineHullMaterial(colors.b),
  };
}

// Outline thickness per piece type (scale factor added to base geometry)
const OUTLINE_SCALE = 1.035;

// ── Distinct Staunton Lathe Profiles ───────────────────────────────────────

const STAUNTON_PROFILES: Record<string, [number, number][]> = {
  // Pawn (Smallest, compact ball head)
  p: [
    [0.00, 0.00], [0.36, 0.00], [0.36, 0.04], [0.30, 0.08], [0.24, 0.12],
    [0.16, 0.20], [0.13, 0.36], [0.17, 0.42], [0.19, 0.46], [0.14, 0.50],
    [0.17, 0.58], [0.16, 0.68], [0.10, 0.76], [0.00, 0.80],
  ],
  // Rook (Wide sturdy castle tower with flat roof)
  r: [
    [0.00, 0.00], [0.40, 0.00], [0.40, 0.04], [0.34, 0.08], [0.28, 0.12],
    [0.20, 0.20], [0.18, 0.52], [0.22, 0.56], [0.26, 0.62], [0.26, 0.74],
    [0.00, 0.74],
  ],
  // Bishop (Camel — Sleek mitre with finial ball top)
  b: [
    [0.00, 0.00], [0.38, 0.00], [0.38, 0.04], [0.32, 0.08], [0.26, 0.12],
    [0.17, 0.20], [0.14, 0.45], [0.19, 0.52], [0.21, 0.58], [0.17, 0.65],
    [0.14, 0.78], [0.07, 0.88], [0.00, 0.94],
  ],
  // Knight (Horse Base)
  n: [
    [0.00, 0.00], [0.38, 0.00], [0.38, 0.04], [0.32, 0.08], [0.26, 0.12],
    [0.19, 0.20], [0.17, 0.35], [0.21, 0.40], [0.00, 0.40],
  ],
  // Queen (Flared crown bowl + coronet)
  q: [
    [0.00, 0.00], [0.42, 0.00], [0.42, 0.04], [0.36, 0.08], [0.30, 0.12],
    [0.20, 0.20], [0.15, 0.48], [0.22, 0.56], [0.26, 0.64], [0.24, 0.74],
    [0.18, 0.86], [0.10, 0.94], [0.00, 1.02],
  ],
  // King (Tallest, majestic crown cap + cross)
  k: [
    [0.00, 0.00], [0.42, 0.00], [0.42, 0.04], [0.36, 0.08], [0.30, 0.12],
    [0.20, 0.20], [0.15, 0.48], [0.22, 0.56], [0.26, 0.64], [0.24, 0.74],
    [0.18, 0.86], [0.12, 0.96], [0.00, 1.08],
  ],
};

function buildLathe(profile: [number, number][]): THREE.LatheGeometry {
  const pts = profile.map(([r, h]) => new THREE.Vector2(r, h));
  return new THREE.LatheGeometry(pts, 36);
}

// ── No-op raycast function for outline meshes ───────────────────────────────
// Prevents outline hulls from intercepting pointer events meant for the piece body
const noopRaycast = () => {};

interface PieceProps {
  square: string;
  pieceType: string;
  pieceColor: 'w' | 'b';
  isSelected: boolean;
  canSelect: boolean;
  onClick: (sq: string) => void;
}

export function ChessPiece3D({ square, pieceType, pieceColor, isSelected, canSelect, onClick }: PieceProps) {
  const targetPos = useMemo(() => sqToPos(square), [square]);
  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef<[number, number, number]>([targetPos[0], 0.1, targetPos[2]]);

  const animProgress = useRef<number>(1);
  const startPos = useRef<[number, number, number]>([targetPos[0], 0.1, targetPos[2]]);

  useEffect(() => {
    if (
      currentPos.current[0] !== targetPos[0] ||
      currentPos.current[2] !== targetPos[2]
    ) {
      startPos.current = [...currentPos.current];
      animProgress.current = 0;
    }
  }, [targetPos]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (animProgress.current < 1) {
      animProgress.current = Math.min(1, animProgress.current + delta * 2.8);
      const t = animProgress.current;

      const x = THREE.MathUtils.lerp(startPos.current[0], targetPos[0], t);
      const z = THREE.MathUtils.lerp(startPos.current[2], targetPos[2], t);
      const arcY = 0.1 + Math.sin(t * Math.PI) * 0.55;

      currentPos.current = [x, arcY, z];
      groupRef.current.position.set(x, arcY, z);
    } else {
      // Gentle elevation when selected
      const hoverY = isSelected ? 0.22 + Math.sin(Date.now() * 0.005) * 0.03 : 0.1;
      groupRef.current.position.set(targetPos[0], hoverY, targetPos[2]);
      currentPos.current = [targetPos[0], hoverY, targetPos[2]];
    }
  });

  const mat = pieceColor === 'w' ? WHITE_PIECE_MAT : BLACK_PIECE_MAT;
  const hullMat = HULL_MATS[pieceType]?.[pieceColor] || HULL_MATS.p[pieceColor];
  // Crown/accent details use white pearl for white pieces, gold for brown pieces
  const accentMat = pieceColor === 'w' ? WHITE_ACCENT_MAT : GOLD_ACCENT_MAT;

  // Build lathe geometry
  const latheGeom = useMemo(() => buildLathe(STAUNTON_PROFILES[pieceType] || STAUNTON_PROFILES.p), [pieceType]);

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onClick(square);
  };

  return (
    <group
      ref={groupRef}
      position={[targetPos[0], 0.1, targetPos[2]]}
      onPointerDown={handleClick}
    >
      {/* Main Piece Body */}
      <mesh castShadow receiveShadow geometry={latheGeom} material={mat} />

      {/* Inverted Hull Outline (BackSide rendering, slightly scaled up) */}
      <mesh
        geometry={latheGeom}
        material={hullMat}
        scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]}
        raycast={noopRaycast}
      />

      {/* ── Selection Indicator (subtle cyan glow ring) ──────────────────────── */}
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noopRaycast}>
          <ringGeometry args={[0.38, 0.44, 32]} />
          <meshBasicMaterial
            color="#38BDF8"
            side={THREE.DoubleSide}
            transparent
            opacity={0.65}
          />
        </mesh>
      )}

      {/* ── Rook Battlements ────────────────────────────────────────────────── */}
      {pieceType === 'r' && (
        <group position={[0, 0.74, 0]}>
          {[0, 90, 180, 270].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <group key={i} position={[Math.sin(rad) * 0.18, 0.05, Math.cos(rad) * 0.18]}>
                <mesh castShadow receiveShadow material={mat}>
                  <boxGeometry args={[0.09, 0.09, 0.09]} />
                </mesh>
                {/* Battlement hull outline */}
                <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
                  <boxGeometry args={[0.09, 0.09, 0.09]} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* ── Knight (Horse) Sculpted Geometry ────────────────────────────────── */}
      {pieceType === 'n' && (
        <group position={[0, 0.38, 0]} rotation={[0, pieceColor === 'w' ? 0 : Math.PI, 0]}>
          {/* Arched Neck */}
          <group position={[0, 0.11, 0.02]} rotation={[0.32, 0, 0]}>
            <mesh castShadow receiveShadow material={mat}>
              <cylinderGeometry args={[0.13, 0.18, 0.24, 20]} />
            </mesh>
            <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
              <cylinderGeometry args={[0.13, 0.18, 0.24, 20]} />
            </mesh>
          </group>
          {/* Head Main Block */}
          <group position={[0, 0.26, 0.06]} rotation={[0.22, 0, 0]}>
            <mesh castShadow receiveShadow material={mat}>
              <boxGeometry args={[0.22, 0.26, 0.30]} />
            </mesh>
            <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
              <boxGeometry args={[0.22, 0.26, 0.30]} />
            </mesh>
          </group>
          {/* Tapered Snout */}
          <group position={[0, 0.21, 0.20]} rotation={[0.08, 0, 0]}>
            <mesh castShadow receiveShadow material={mat}>
              <boxGeometry args={[0.15, 0.14, 0.16]} />
            </mesh>
            <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
              <boxGeometry args={[0.15, 0.14, 0.16]} />
            </mesh>
          </group>
          {/* Left Ear */}
          <group position={[-0.07, 0.39, 0.04]} rotation={[-0.1, -0.1, 0]}>
            <mesh castShadow material={mat}>
              <coneGeometry args={[0.035, 0.12, 10]} />
            </mesh>
            <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
              <coneGeometry args={[0.035, 0.12, 10]} />
            </mesh>
          </group>
          {/* Right Ear */}
          <group position={[0.07, 0.39, 0.04]} rotation={[-0.1, 0.1, 0]}>
            <mesh castShadow material={mat}>
              <coneGeometry args={[0.035, 0.12, 10]} />
            </mesh>
            <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
              <coneGeometry args={[0.035, 0.12, 10]} />
            </mesh>
          </group>
          {/* Mane Ridge */}
          <group position={[0, 0.25, -0.06]} rotation={[0.3, 0, 0]}>
            <mesh castShadow material={mat}>
              <boxGeometry args={[0.05, 0.26, 0.08]} />
            </mesh>
            <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
              <boxGeometry args={[0.05, 0.26, 0.08]} />
            </mesh>
          </group>
        </group>
      )}

      {/* ── Bishop: Pointed Mitre Spike + Collar Band ───────────────────────── */}
      {pieceType === 'b' && (
        <group>
          {/* Distinctive mid-body collar band — unique to bishop */}
          <mesh castShadow position={[0, 0.65, 0]} material={accentMat}>
            <torusGeometry args={[0.155, 0.022, 12, 36]} />
          </mesh>
          {/* Pointed spike finial — clearly NOT an orb, unlike queen */}
          <group position={[0, 0.94, 0]}>
            <group position={[0, 0.04, 0]}>
              {/* Base of spike */}
              <mesh castShadow material={mat}>
                <sphereGeometry args={[0.036, 12, 12]} />
              </mesh>
              {/* Spike point */}
              <mesh castShadow position={[0, 0.07, 0]} material={accentMat}>
                <coneGeometry args={[0.028, 0.10, 10]} />
              </mesh>
            </group>
          </group>
        </group>
      )}

      {/* ── Queen: Crown Ring + 5 Pearl Orbs ────────────────────────────────── */}
      {pieceType === 'q' && (
        <group position={[0, 0.86, 0]}>
          {/* Golden coronet ring */}
          <mesh castShadow position={[0, 0.02, 0]} material={accentMat}>
            <torusGeometry args={[0.17, 0.018, 12, 36]} />
          </mesh>
          {/* 5 pearl orbs arranged in a crown ring — unmistakable queen silhouette */}
          {[0, 72, 144, 216, 288].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const r = 0.13;
            return (
              <group key={i} position={[Math.sin(rad) * r, 0.10, Math.cos(rad) * r]}>
                <mesh castShadow material={mat}>
                  <sphereGeometry args={[0.038, 14, 14]} />
                </mesh>
                <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
                  <sphereGeometry args={[0.038, 14, 14]} />
                </mesh>
              </group>
            );
          })}
          {/* Centre top orb */}
          <group position={[0, 0.20, 0]}>
            <mesh castShadow material={mat}>
              <sphereGeometry args={[0.045, 16, 16]} />
            </mesh>
            <mesh material={hullMat} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} raycast={noopRaycast}>
              <sphereGeometry args={[0.045, 16, 16]} />
            </mesh>
          </group>
        </group>
      )}

      {/* ── King: Golden Crown Ring + 4 Prongs + Cross ──────────────────────── */}
      {pieceType === 'k' && (
        <group position={[0, 0.86, 0]}>
          {/* Golden crown base ring */}
          <mesh castShadow position={[0, 0.02, 0]} material={accentMat}>
            <torusGeometry args={[0.19, 0.022, 12, 36]} />
          </mesh>
          {/* 4 Crown prongs at cardinal points */}
          {[0, 90, 180, 270].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const r = 0.15;
            return (
              <mesh
                key={i}
                castShadow
                material={accentMat}
                position={[Math.sin(rad) * r, 0.12, Math.cos(rad) * r]}
              >
                <coneGeometry args={[0.025, 0.13, 8]} />
              </mesh>
            );
          })}
          {/* Royal cross on top — the king's unique identifier */}
          <group position={[0, 0.22, 0]}>
            {/* Vertical beam */}
            <mesh castShadow material={accentMat} position={[0, 0.07, 0]}>
              <boxGeometry args={[0.04, 0.16, 0.04]} />
            </mesh>
            {/* Horizontal beam */}
            <mesh castShadow material={accentMat} position={[0, 0.10, 0]}>
              <boxGeometry args={[0.16, 0.04, 0.04]} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
