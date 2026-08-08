import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// ── Procedural Wood Texture Generator for Board Squares ──────────────────────

function createSquareWoodTexture(baseHex: string, grainHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    const alpha = 0.03 + Math.sin(y * 0.1) * 0.02 + Math.random() * 0.04;
    ctx.fillStyle = grainHex;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, y, 256, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

const lightWoodTex = createSquareWoodTexture('#F2DEC4', '#B89B72');
const darkWoodTex = createSquareWoodTexture('#B37B4C', '#5C3818');

// ── Square coordinate helpers ─────────────────────────────────────────────────

export function sqToPos(sq: string): [number, number, number] {
  const file = sq.charCodeAt(0) - 97; // a=0 h=7
  const rank = parseInt(sq[1]) - 1;   // 1=0 8=7
  return [file + 0.5, 0, (7 - rank) + 0.5];
}

export function posToSq(x: number, z: number): string | null {
  const file = Math.floor(x);
  const rank = 7 - Math.floor(z);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return String.fromCharCode(97 + file) + (rank + 1);
}

// ── Square (board cell) ───────────────────────────────────────────────────────

interface SquareProps {
  file: number;
  rank: number;
  isSelected: boolean;
  isLastMove: boolean;
  onPointerDown: (sq: string) => void;
}

export function BoardSquare({ file, rank, isSelected, isLastMove, onPointerDown }: SquareProps) {
  const isLight = (file + rank) % 2 === 1;
  const sq = String.fromCharCode(97 + file) + (rank + 1);
  const x = file + 0.5;
  const z = (7 - rank) + 0.5;

  let color: string;
  if (isSelected) color = '#F6F669';
  else if (isLastMove) color = isLight ? '#CDD26A' : '#AABA59';
  else color = isLight ? '#F5E3CB' : '#B07B4F';

  const map = isLight ? lightWoodTex : darkWoodTex;

  return (
    <mesh
      position={[x, 0, z]}
      receiveShadow
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(sq);
      }}
    >
      <boxGeometry args={[1, 0.1, 1]} />
      <meshStandardMaterial
        color={color}
        map={isSelected || isLastMove ? undefined : map}
        roughness={0.5}
        metalness={0.03}
      />
    </mesh>
  );
}

// ── Board frame ───────────────────────────────────────────────────────────────

export function BoardFrame() {
  const woodColor = '#321602';
  const frameRoughness = 0.85;
  const thickness = 0.7;
  const height = 0.15;
  const y = 0.025;

  return (
    <group>
      {/* South border */}
      <mesh position={[4, y, 8 + thickness / 2]} receiveShadow castShadow>
        <boxGeometry args={[8 + thickness * 2, height, thickness]} />
        <meshStandardMaterial color={woodColor} roughness={frameRoughness} />
      </mesh>
      {/* North border */}
      <mesh position={[4, y, -thickness / 2]} receiveShadow castShadow>
        <boxGeometry args={[8 + thickness * 2, height, thickness]} />
        <meshStandardMaterial color={woodColor} roughness={frameRoughness} />
      </mesh>
      {/* West border */}
      <mesh position={[-thickness / 2, y, 4]} receiveShadow castShadow>
        <boxGeometry args={[thickness, height, 8]} />
        <meshStandardMaterial color={woodColor} roughness={frameRoughness} />
      </mesh>
      {/* East border */}
      <mesh position={[8 + thickness / 2, y, 4]} receiveShadow castShadow>
        <boxGeometry args={[thickness, height, 8]} />
        <meshStandardMaterial color={woodColor} roughness={frameRoughness} />
      </mesh>
      {/* Base slab */}
      <mesh position={[4, -0.06, 4]} receiveShadow>
        <boxGeometry args={[8 + thickness * 2 + 0.1, 0.05, 8 + thickness * 2 + 0.1]} />
        <meshStandardMaterial color="#1F0E02" roughness={0.95} />
      </mesh>

      {/* File Labels (a-h) along South border */}
      {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((char, i) => (
        <mesh key={`f-${char}`} position={[i + 0.5, y + 0.08, 8.35]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshStandardMaterial
            color="#D4AF37"
            roughness={0.4}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Rank Labels (1-8) along West border */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((num, i) => (
        <mesh key={`r-${num}`} position={[-0.35, y + 0.08, (7 - i) + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshStandardMaterial
            color="#D4AF37"
            roughness={0.4}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Move Hint indicators ──────────────────────────────────────────────────────

interface MoveHintProps {
  square: string;
  isCapture: boolean;
  onClick: (sq: string) => void;
}

function MoveHintRing({ square, isCapture, onClick }: MoveHintProps) {
  const [x, , z] = sqToPos(square);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.material &&
        ((meshRef.current.material as THREE.MeshStandardMaterial).opacity =
          0.55 + Math.sin(clock.elapsedTime * 4) * 0.15);
    }
  });

  if (isCapture) {
    return (
      <mesh
        ref={meshRef}
        position={[x, 0.06, z]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(e) => { e.stopPropagation(); onClick(square); }}
      >
        <ringGeometry args={[0.38, 0.49, 32]} />
        <meshStandardMaterial
          color="#EF4444"
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          depthWrite={false}
          emissive="#EF4444"
          emissiveIntensity={0.5}
        />
      </mesh>
    );
  }

  return (
    <mesh
      ref={meshRef}
      position={[x, 0.06, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => { e.stopPropagation(); onClick(square); }}
    >
      <circleGeometry args={[0.18, 24]} />
      <meshStandardMaterial
        color="#22C55E"
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
        depthWrite={false}
        emissive="#22C55E"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

interface MoveHintsProps {
  legalMoves: string[];
  board: (({ type: string; color: string } | null)[])[];
  onMove: (sq: string) => void;
}

export function MoveHints({ legalMoves, board, onMove }: MoveHintsProps) {
  return (
    <>
      {legalMoves.map((sq) => {
        const file = sq.charCodeAt(0) - 97;
        const rank = parseInt(sq[1]) - 1;
        const piece = board[7 - rank]?.[file];
        return (
          <MoveHintRing
            key={sq}
            square={sq}
            isCapture={!!piece}
            onClick={onMove}
          />
        );
      })}
    </>
  );
}

// ── Selection glow ────────────────────────────────────────────────────────────

export function SelectionGlow({ square }: { square: string }) {
  const [x, , z] = sqToPos(square);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.4 + Math.sin(clock.elapsedTime * 5) * 0.12;
    }
  });

  return (
    <mesh ref={meshRef} position={[x, 0.07, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 0.49, 32]} />
      <meshStandardMaterial
        color="#38BDF8"
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
        depthWrite={false}
        emissive="#38BDF8"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

// ── Board component ───────────────────────────────────────────────────────────

interface BoardProps {
  selectedSquare: string | null;
  lastMove: { from: string; to: string } | null;
  onSquareClick: (sq: string) => void;
}

export function Board({ selectedSquare, lastMove, onSquareClick }: BoardProps) {
  const squares = useMemo(() => {
    const s: { file: number; rank: number }[] = [];
    for (let rank = 0; rank < 8; rank++)
      for (let file = 0; file < 8; file++)
        s.push({ file, rank });
    return s;
  }, []);

  const lastMoveSqs = useMemo(() => {
    if (!lastMove) return new Set<string>();
    return new Set([lastMove.from, lastMove.to]);
  }, [lastMove]);

  return (
    <group>
      <BoardFrame />
      {squares.map(({ file, rank }) => {
        const sq = String.fromCharCode(97 + file) + (rank + 1);
        return (
          <BoardSquare
            key={sq}
            file={file}
            rank={rank}
            isSelected={selectedSquare === sq}
            isLastMove={lastMoveSqs.has(sq)}
            onPointerDown={onSquareClick}
          />
        );
      })}
      {selectedSquare && <SelectionGlow square={selectedSquare} />}
    </group>
  );
}
