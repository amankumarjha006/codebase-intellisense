import * as React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cn } from '../../lib/utils';

export interface SpectralDrapeProps {
  colors?: string[];
  backgroundColor?: string;
  density?: number;
  dotSize?: number;
  strands?: number;
  amplitude?: number;
  frequency?: number;
  thickness?: number;
  depth?: number;
  softness?: number;
  intensity?: number;
  colorShift?: number;
  tilt?: number;
  turn?: number;
  roll?: number;
  zoom?: number;
  flow?: number;
  speed?: number;
  interactive?: boolean;
  brush?: number;
  brushRadius?: number;
  parallax?: number;
  clickRipples?: boolean;
  seed?: number;
  paused?: boolean;
  dpr?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const DEFAULT_COLORS = ['#6A4BFF', '#E4DBFF'];

const vertexShader = /* glsl */ `
#define MAX_STRANDS 12
#define MAX_RIPPLES 4

attribute vec2 aGrid;

uniform float uTime;
uniform float uClock;
uniform float uSeed;
uniform float uStrands;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uThickness;
uniform float uDepth;
uniform float uSpacing;
uniform float uSize;
uniform float uViewHeight;
uniform float uIntensity;
uniform float uShift;
uniform vec3 uBodyLab;
uniform vec3 uGlowLab;
uniform vec3 uWake;
uniform vec3 uWakeVector;
uniform float uWakeRadius;
uniform float uAspect;
uniform vec4 uRipple[MAX_RIPPLES];

varying vec3 vColor;
varying float vGlow;

float hash(float n) {
  return fract(sin(n * 127.1 + uSeed * 311.7) * 43758.5453);
}

vec3 labToLinear(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float strands(vec2 g, float t) {
  float sum = 0.0;
  for (int k = 0; k < MAX_STRANDS; k++) {
    float index = float(k);
    if (index >= uStrands) break;
    float a = hash(index + 1.0);
    float b = hash(index + 17.0);
    float c = hash(index + 43.0);
    float frequency = uFrequency * (0.55 + 0.9 * a);
    float phase = b * 6.2831853;
    float along = g.x * 6.2831853 * frequency;
    float wave =
      sin(along + phase + t * (0.35 + 0.45 * a)) * 0.62 +
      sin(along * 2.07 - phase * 1.31 - t * (0.27 + 0.36 * b)) * 0.26 +
      sin(along * 0.47 + phase * 0.7 + t * (0.19 + 0.2 * c)) * 0.3;
    float line = 0.5 + (c - 0.5) * 0.8 + uAmplitude * 0.16 * wave;
    float width = uThickness * (0.022 + 0.05 * c) * (0.75 + 0.5 * sin(along * 0.5 + t * 0.4 + phase));
    float d = (g.y - line) / max(width, 0.004);
    sum += exp(-d * d);
  }
  float edge = smoothstep(0.0, 0.12, g.y) * (1.0 - smoothstep(0.88, 1.0, g.y)) *
    smoothstep(0.0, 0.05, g.x) * (1.0 - smoothstep(0.95, 1.0, g.x));
  return (1.0 - exp(-sum * 1.1)) * edge;
}

void main() {
  float field = strands(aGrid, uTime);
  vec3 local = vec3((aGrid.x - 0.5) * 11.0, (aGrid.y - 0.5) * 11.0, field * uDepth);

  float reveal = 0.0;
  for (int k = 0; k < MAX_RIPPLES; k++) {
    vec4 ripple = uRipple[k];
    float age = uClock - ripple.z;
    if (ripple.w <= 0.0 || age < 0.0 || age > 6.0) continue;
    float radius = length((aGrid - ripple.xy) * 11.0);
    float front = radius - age * 3.4;
    float envelope = exp(-front * front * 3.0) * exp(-age * 0.5) * ripple.w;
    local.z += sin(front * 3.2) * 0.3 * envelope;
    reveal += envelope;
  }

  vec4 world = modelMatrix * vec4(local, 1.0);
  vec4 clip = projectionMatrix * viewMatrix * world;
  vec2 ndc = clip.xy / clip.w;
  vec2 offset = (ndc - uWake.xy) * vec2(uAspect, 1.0);
  float touch = exp(-dot(offset, offset) / max(uWakeRadius * uWakeRadius, 1e-4)) * uWake.z;
  world.xyz += uWakeVector * touch;

  vec4 view = viewMatrix * world;
  gl_Position = projectionMatrix * view;

  float eye = -view.z;
  float size = uSpacing * uSize * projectionMatrix[1][1] * uViewHeight * 0.5 / max(eye, 0.1);
  float nearness = clamp(9.0 / max(eye, 0.1), 0.35, 1.8);
  float shade = mix(0.35, 1.0, smoothstep(0.55, 1.2, nearness));

  float lift = smoothstep(0.06, 0.95, field);
  float glow = (pow(lift, 1.35) * 1.3 + reveal * 1.1) * shade * uIntensity;
  float shown = max(size, 1.35);
  vGlow = glow * min(size * size / (shown * shown), 1.0);
  gl_PointSize = shown * (1.0 + touch * 0.35);

  float tone = clamp(lift * 0.9 + (aGrid.x - 0.5) * uShift + reveal * 0.25, 0.0, 1.0);
  vec3 lab = mix(uBodyLab, uGlowLab, tone);
  vColor = toSrgb(max(labToLinear(lab), vec3(0.0)));
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uSoftness;
uniform float uInk;

varying vec3 vColor;
varying float vGlow;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float disc = 1.0 - smoothstep(mix(0.55, 0.0, uSoftness), 1.0, r);
  float amount = disc * vGlow;
  if (amount < 0.003) discard;
  if (uInk > 0.5) {
    float alpha = clamp(amount, 0.0, 1.0);
    gl_FragColor = vec4(vColor * alpha, alpha);
  } else {
    gl_FragColor = vec4(vColor * amount, clamp(amount, 0.0, 1.0));
  }
}
`;

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
const rad = (deg: number) => (deg * Math.PI) / 180;

const isTransparent = (color: string) => {
  const c = color.trim().toLowerCase();
  return (
    c === 'transparent' ||
    (/^#[0-9a-f]{8}$/.test(c)
      ? c.endsWith('00')
      : /^#[0-9a-f]{4}$/.test(c)
        ? c.endsWith('0')
        : null !== c.match(/^(?:rgba?|hsla?)\(.*[,/]\s*(0|0?\.0+|0%)\s*\)$/))
  );
};

const parseColor = (target: THREE.Color, str: string, fallback: string) => {
  const clean = str.trim();
  try {
    target.set(/^#[0-9a-f]{8}$/i.test(clean) ? clean.slice(0, 7) : clean);
  } catch {
    target.set(fallback);
  }
  return target;
};

const rgbToOklab = (target: THREE.Vector3, color: THREE.Color) => {
  const l = Math.cbrt(0.4122214708 * color.r + 0.5363325363 * color.g + 0.0514459929 * color.b);
  const m = Math.cbrt(0.2119034982 * color.r + 0.6806995451 * color.g + 0.1073969566 * color.b);
  const s = Math.cbrt(0.0883024619 * color.r + 0.2817188376 * color.g + 0.6299787005 * color.b);
  return target.set(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  );
};

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
  presses: number;
  pressX: number;
  pressY: number;
}

interface InnerDrapeProps {
  settings: Required<Omit<SpectralDrapeProps, 'className' | 'style' | 'children'>> & {
    reduced: boolean;
  };
  pointerRef: React.RefObject<PointerState>;
  wakeRef: React.RefObject<(() => void) | null>;
}

function InnerDrape({ settings, pointerRef, wakeRef }: InnerDrapeProps) {
  const { size, invalidate } = useThree();
  const groupRef = React.useRef<THREE.Group>(null);
  const matRef = React.useRef<THREE.ShaderMaterial>(null);

  const stateRef = React.useRef({
    time: 0,
    clock: 0,
    leanX: 0,
    leanY: 0,
    wakeX: 9,
    wakeY: 9,
    lastX: 0.5,
    lastY: 0.5,
    hasLast: false,
    velocityX: 0,
    velocityY: 0,
    strength: 0,
    presses: 0,
    nextRipple: 0,
    ripples: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -99, 0)),
  });

  const mathCache = React.useMemo(
    () => ({
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      raycaster: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      plane: new THREE.Plane(),
      normal: new THREE.Vector3(),
      point: new THREE.Vector3(),
      inverse: new THREE.Matrix4(),
      euler: new THREE.Euler(),
    }),
    []
  );

  const uniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uClock: { value: 0 },
      uSeed: { value: 0 },
      uStrands: { value: 8 },
      uAmplitude: { value: 1 },
      uFrequency: { value: 0.6 },
      uThickness: { value: 1 },
      uDepth: { value: 1.6 },
      uSpacing: { value: 0.04 },
      uSize: { value: 0.5 },
      uViewHeight: { value: 600 },
      uIntensity: { value: 1 },
      uShift: { value: 0 },
      uBodyLab: { value: new THREE.Vector3() },
      uGlowLab: { value: new THREE.Vector3() },
      uWake: { value: new THREE.Vector3(9, 9, 0) },
      uWakeVector: { value: new THREE.Vector3() },
      uWakeRadius: { value: 0.3 },
      uAspect: { value: 1 },
      uRipple: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uSoftness: { value: 0.6 },
      uInk: { value: 0 },
    }),
    []
  );

  const gridData = React.useMemo(() => {
    const rootDensity = Math.sqrt(clamp(settings.density, 0.2, 2.5));
    const cols = Math.max(24, Math.round(260 * rootDensity));
    const rows = Math.max(16, Math.round(170 * rootDensity));
    const gridArray = new Float32Array(cols * rows * 2);
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        gridArray[idx++] = c / (cols - 1);
        gridArray[idx++] = r / (rows - 1);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('aGrid', new THREE.BufferAttribute(gridArray, 2));
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cols * rows * 3), 3));
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 22);
    return {
      geometry: geom,
      spacing: 11 / (cols - 1),
    };
  }, [settings.density]);

  React.useEffect(() => () => gridData.geometry.dispose(), [gridData]);

  React.useEffect(() => {
    (wakeRef as React.MutableRefObject<(() => void) | null>).current = invalidate;
    return () => {
      (wakeRef as React.MutableRefObject<(() => void) | null>).current = null;
    };
  }, [invalidate, wakeRef]);

  const colorKey = settings.colors.join('|');
  const { backgroundColor } = settings;

  React.useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const u = mat.uniforms;
    const cols = colorKey ? colorKey.split('|') : DEFAULT_COLORS;
    const tmp = new THREE.Color();
    parseColor(tmp, cols[0] ?? DEFAULT_COLORS[0], DEFAULT_COLORS[0]);
    rgbToOklab(u.uBodyLab.value, tmp);
    parseColor(tmp, cols[1] ?? cols[0] ?? DEFAULT_COLORS[1], DEFAULT_COLORS[1]);
    rgbToOklab(u.uGlowLab.value, tmp);

    const transparent = isTransparent(backgroundColor);
    parseColor(tmp, transparent ? '#000000' : backgroundColor, '#000000');
    const lum = 0.2126 * tmp.r + 0.7152 * tmp.g + 0.0722 * tmp.b;
    const isLight = !transparent && lum > 0.25;

    u.uInk.value = isLight ? 1 : 0;
    mat.blending = THREE.CustomBlending;
    mat.blendEquation = THREE.AddEquation;
    mat.blendSrc = THREE.OneFactor;
    mat.blendDst = isLight ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor;
    mat.blendSrcAlpha = THREE.OneFactor;
    mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    mat.needsUpdate = true;
    invalidate();
  }, [colorKey, backgroundColor, invalidate]);

  React.useEffect(() => {
    invalidate();
  }, [settings, size, invalidate]);

  useFrame((sceneState, delta) => {
    const group = groupRef.current;
    const mat = matRef.current;
    if (!group || !mat) return;
    const u = mat.uniforms;
    const st = stateRef.current;
    const ptr = pointerRef.current || { x: 0.5, y: 0.5, inside: false, presses: 0, pressX: 0, pressY: 0 };
    const dt = Math.min(Math.max(delta, 0), 0.05);

    const isMoving = !settings.paused && !settings.reduced;
    if (isMoving) {
      st.time += dt * clamp(settings.speed, 0, 4) * clamp(settings.flow, 0, 4) * 0.3;
    }
    if (!settings.reduced) {
      st.clock += dt;
    }

    const aspect = size.width / Math.max(size.height, 1);
    const camera = sceneState.camera;
    const isInside = settings.interactive && !settings.reduced && ptr.inside;
    const parallaxAmt = clamp(settings.parallax, 0, 3);
    const targetLeanX = isInside ? (ptr.x - 0.5) * 2 : 0;
    const targetLeanY = isInside ? (ptr.y - 0.5) * 2 : 0;
    const leanSmoothing = 1 - Math.exp(-2.2 * dt);

    st.leanX += (targetLeanX - st.leanX) * leanSmoothing;
    st.leanY += (targetLeanY - st.leanY) * leanSmoothing;

    mathCache.euler.set(
      rad(clamp(settings.tilt, -180, 180)) - 0.06 * st.leanY * parallaxAmt,
      rad(clamp(settings.turn, -180, 180)) + 0.08 * st.leanX * parallaxAmt,
      rad(clamp(settings.roll, -180, 180)),
      'XYZ'
    );
    group.rotation.copy(mathCache.euler);
    group.scale.setScalar(clamp(settings.zoom, 0.3, 3));
    group.updateMatrixWorld();

    let vx = 0;
    let vy = 0;
    if (isInside) {
      if (!st.hasLast) {
        st.lastX = ptr.x;
        st.lastY = ptr.y;
        st.wakeX = ptr.x;
        st.wakeY = ptr.y;
        st.hasLast = true;
      }
      if (dt > 0) {
        vx = (ptr.x - st.lastX) / dt;
        vy = (ptr.y - st.lastY) / dt;
      }
      st.lastX = ptr.x;
      st.lastY = ptr.y;
    } else {
      st.hasLast = false;
    }

    const velSmoothing = 1 - Math.exp(-6 * dt);
    st.velocityX += (clamp(vx, -5, 5) - st.velocityX) * velSmoothing;
    st.velocityY += (clamp(vy, -5, 5) - st.velocityY) * velSmoothing;

    const wakeSmoothing = 1 - Math.exp(-7 * dt);
    if (isInside) {
      st.wakeX += (ptr.x - st.wakeX) * wakeSmoothing;
      st.wakeY += (ptr.y - st.wakeY) * wakeSmoothing;
    }

    const speedHypot = Math.hypot(st.velocityX * aspect, st.velocityY);
    const targetStrength = isInside ? clamp(0.9 * speedHypot, 0, 1.4) : 0;
    st.strength += (targetStrength - st.strength) * (1 - Math.exp(-4 * dt));

    camera.updateMatrixWorld();
    mathCache.right.setFromMatrixColumn(camera.matrixWorld, 0);
    mathCache.up.setFromMatrixColumn(camera.matrixWorld, 1);

    const fovScale = 9 * Math.tan(rad(38) / 2);
    const brushFactor = clamp(settings.brush, 0, 3);
    const normVx = st.velocityX / Math.max(speedHypot, 1e-4);
    const normVy = st.velocityY / Math.max(speedHypot, 1e-4);

    u.uWake.value.set(2 * st.wakeX - 1, 2 * st.wakeY - 1, st.strength * brushFactor);
    u.uWakeVector.value
      .copy(mathCache.right)
      .multiplyScalar(normVx * aspect * fovScale * 0.16)
      .addScaledVector(mathCache.up, normVy * fovScale * 0.16);
    u.uWakeRadius.value = clamp(settings.brushRadius, 0.03, 1);

    // Ripple click detection
    if (
      ptr.presses !== st.presses &&
      settings.clickRipples &&
      settings.interactive &&
      !settings.reduced
    ) {
      st.presses = ptr.presses;
      mathCache.ndc.set(ptr.pressX, ptr.pressY);
      mathCache.raycaster.setFromCamera(mathCache.ndc, camera);
      mathCache.normal.set(0, 0, 1).transformDirection(group.matrixWorld);
      mathCache.point.setFromMatrixPosition(group.matrixWorld);
      mathCache.plane.setFromNormalAndCoplanarPoint(mathCache.normal, mathCache.point);

      if (mathCache.raycaster.ray.intersectPlane(mathCache.plane, mathCache.point)) {
        mathCache.inverse.copy(group.matrixWorld).invert();
        mathCache.point.applyMatrix4(mathCache.inverse);
        const rIndex = st.nextRipple;
        st.nextRipple = (rIndex + 1) % 4;
        st.ripples[rIndex].set(
          clamp(mathCache.point.x / 11 + 0.5, -0.5, 1.5),
          clamp(mathCache.point.y / 11 + 0.5, -0.5, 1.5),
          st.clock,
          1
        );
      }
    }

    let hasActiveRipples = false;
    for (let r = 0; r < 4; r++) {
      u.uRipple.value[r].copy(st.ripples[r]);
      if (st.ripples[r].w > 0 && st.clock - st.ripples[r].z < 6) {
        hasActiveRipples = true;
      }
    }

    u.uTime.value = st.time;
    u.uClock.value = st.clock;
    u.uSeed.value = 0.137 * settings.seed;
    u.uStrands.value = Math.round(clamp(settings.strands, 1, 12));
    u.uAmplitude.value = clamp(settings.amplitude, 0, 3);
    u.uFrequency.value = 0.6 * clamp(settings.frequency, 0.05, 4);
    u.uThickness.value = clamp(settings.thickness, 0.2, 4);
    u.uDepth.value = 1.6 * clamp(settings.depth, 0, 3);
    u.uSpacing.value = gridData.spacing;
    u.uSize.value = 0.5 * clamp(settings.dotSize, 0.1, 4);
    u.uViewHeight.value = size.height * sceneState.viewport.dpr;
    u.uIntensity.value = clamp(settings.intensity, 0, 4);
    u.uShift.value = clamp(settings.colorShift, -1, 1);
    u.uAspect.value = aspect;
    u.uSoftness.value = clamp(settings.softness, 0, 1);

    const needsRedraw =
      hasActiveRipples ||
      st.strength > 0.002 ||
      Math.abs(st.leanX - targetLeanX) > 0.001 ||
      Math.abs(st.leanY - targetLeanY) > 0.001;

    if (!isMoving && needsRedraw) {
      invalidate();
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={gridData.geometry} frustumCulled={false}>
        <shaderMaterial
          ref={matRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent={true}
          depthTest={false}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

export function SpectralDrape({
  colors = DEFAULT_COLORS,
  backgroundColor = '#0a0a0a',
  density = 1,
  dotSize = 1,
  strands = 8,
  amplitude = 1,
  frequency = 1,
  thickness = 0.7,
  depth = 1,
  softness = 0.6,
  intensity = 1,
  colorShift = 0.3,
  tilt = -40,
  turn = -45,
  roll = 110,
  zoom = 1,
  flow = 1,
  speed = 1,
  interactive = true,
  brush = 1,
  brushRadius = 0.2,
  parallax = 1,
  clickRipples = true,
  seed = 0,
  paused = false,
  dpr = 2,
  className,
  style,
  children,
}: SpectralDrapeProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pointerState = React.useRef<PointerState>({
    x: 0.5,
    y: 0.5,
    inside: false,
    presses: 0,
    pressX: 0,
    pressY: 0,
  });
  const wakeRef = React.useRef<(() => void) | null>(null);
  const [isVisible, setIsVisible] = React.useState(true);

  // Check prefers-reduced-motion
  const [isReduced, setIsReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReduced(media.matches);
    const handler = (e: MediaQueryListEvent) => setIsReduced(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  // Intersection observer to pause rendering when scrolled out of view
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: '80px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Event handlers
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateCoords = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const p = pointerState.current;
      p.x = (e.clientX - rect.left) / Math.max(rect.width, 1);
      p.y = 1 - (e.clientY - rect.top) / Math.max(rect.height, 1);
      p.inside = true;
    };

    const handlePointerMove = (e: PointerEvent) => {
      updateCoords(e);
      wakeRef.current?.();
    };

    const handlePointerDown = (e: PointerEvent) => {
      updateCoords(e);
      const p = pointerState.current;
      p.pressX = 2 * p.x - 1;
      p.pressY = 2 * p.y - 1;
      p.presses += 1;
      wakeRef.current?.();
    };

    const handlePointerLeave = () => {
      pointerState.current.inside = false;
      wakeRef.current?.();
    };

    el.addEventListener('pointermove', handlePointerMove, { passive: true });
    el.addEventListener('pointerdown', handlePointerDown, { passive: true });
    el.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    el.addEventListener('pointercancel', handlePointerLeave, { passive: true });

    return () => {
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointerleave', handlePointerLeave);
      el.removeEventListener('pointercancel', handlePointerLeave);
    };
  }, []);

  const transparent = isTransparent(backgroundColor);
  const activeAnimation = isVisible && !paused && !isReduced;

  return (
    <div
      ref={containerRef}
      className={cn('relative isolate overflow-hidden', className)}
      style={{
        backgroundColor: transparent ? undefined : backgroundColor,
        ...style,
      }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <Canvas
          dpr={Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, Math.max(dpr, 0.5))}
          frameloop={activeAnimation ? 'always' : 'demand'}
          camera={{ fov: 38, near: 0.1, far: 100, position: [0, 0, 9] }}
          gl={{
            antialias: false,
            alpha: true,
            premultipliedAlpha: true,
            powerPreference: 'high-performance',
          }}
          style={{ pointerEvents: 'none' }}
        >
          <InnerDrape
            settings={{
              colors,
              backgroundColor,
              density,
              dotSize,
              strands,
              amplitude,
              frequency,
              thickness,
              depth,
              softness,
              intensity,
              colorShift,
              tilt,
              turn,
              roll,
              zoom,
              flow,
              speed,
              interactive,
              brush,
              brushRadius,
              parallax,
              clickRipples,
              seed,
              paused,
              dpr,
              reduced: isReduced,
            }}
            pointerRef={pointerState}
            wakeRef={wakeRef}
          />
        </Canvas>
      </div>
      {children ? <div className="relative z-10 h-full w-full">{children}</div> : null}
    </div>
  );
}

export default SpectralDrape;
