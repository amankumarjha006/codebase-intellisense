import * as React from 'react';
import * as THREE from 'three';
import { cn } from '../../lib/utils';

export interface InterferenceRibbonsProps {
  colors?: [string, string];
  backgroundColor?: string;
  mode?: 'auto' | 'glow' | 'ink';
  wires?: number;
  lineWidth?: number;
  ribbonWidth?: number;
  amplitude?: number;
  waveLength?: number;
  angle?: number;
  twist?: number;
  curl?: number;
  depth?: number;
  stripes?: number;
  colorFlow?: number;
  glow?: number;
  intensity?: number;
  speed?: number;
  spin?: number;
  interactive?: boolean;
  hoverPulses?: boolean;
  clickPulse?: boolean;
  pulseSpeed?: number;
  pulseStrength?: number;
  hoverBoost?: number;
  paused?: boolean;
  quality?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface InterferenceRibbonsHandle {
  pulse: (pos?: number) => void;
}

const DEFAULT_COLORS: [string, string] = ['#8AB4F8', '#d3ebff'];

const vertexShader = /* glsl */ `
in vec2 aWire;
in vec2 aSample;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uTime;
uniform float uPulseTime;
uniform float uAngle;
uniform float uExtent;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uHalf;
uniform float uCurl;
uniform float uTwist;
uniform float uSpin;
uniform float uLineWidth;
uniform float uBack;
uniform float uStripes;
uniform float uFlow;
uniform float uEnergy;
uniform float uPulseSpeed;
uniform float uPulseStrength;
uniform float uInk;
uniform vec3 uLabDeep;
uniform vec3 uLabA;
uniform vec3 uLabB;
uniform vec4 uPulses[16];
out float vDist;
out float vHalfPx;
out vec3 vColor;
out float vGain;

vec3 labToLinear(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return max(vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ), 0.0);
}

vec3 palette(float s) {
  s = fract(s) * 3.0;
  vec3 lab = s < 1.0 ? mix(uLabDeep, uLabA, smoothstep(0.0, 1.0, s))
    : s < 2.0 ? mix(uLabA, uLabB, smoothstep(0.0, 1.0, s - 1.0))
    : mix(uLabB, uLabDeep, smoothstep(0.0, 1.0, s - 2.0));
  return labToLinear(lab);
}

float spine(float x) {
  float t = uTime;
  return uAmplitude * (0.62 * sin(x * uFrequency + t * 0.33 + 0.4)
    + 0.26 * sin(x * uFrequency * 1.93 - t * 0.21 + 2.1)
    + 0.12 * sin(x * uFrequency * 3.07 + t * 0.47 + 4.2));
}

vec3 wire(float x, float u, float seed, out float facing) {
  float t = uTime;
  float halfWidth = uHalf * (1.0 + 0.22 * sin(x * 0.61 - t * 0.19 + 1.3));
  float theta = uTwist * x + uSpin;
  float wobble = 0.4 * (sin(x * 2.3 + seed * 6.2831853 + t * 0.7) * 0.6 + sin(x * 3.9 - seed * 11.3 - t * 0.5) * 0.4);
  float xi = u + wobble * 0.05;
  float zeta = uCurl * (u * u - 1.0 / 3.0) + wobble * 0.07;
  float c = cos(theta);
  float s = sin(theta);
  float y = spine(x) + halfWidth * (xi * c - zeta * s);
  float z = xi * s + zeta * c;
  facing = clamp(0.5 + 0.5 * z, 0.0, 1.0);
  return vec3(x, y, z);
}

vec2 toScreen(vec2 p) {
  float unit = 0.5 * uResolution.y;
  float ca = cos(uAngle);
  float sa = sin(uAngle);
  return vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y) * unit + 0.5 * uResolution;
}

void main() {
  float u = aWire.x;
  float seed = aWire.y;
  float x = mix(-uExtent, uExtent, aSample.x);
  float delta = 2.0 * uExtent / 360.0;
  float f0;
  float f1;
  float f2;
  vec3 p0 = wire(x - delta, u, seed, f0);
  vec3 p1 = wire(x, u, seed, f1);
  vec3 p2 = wire(x + delta, u, seed, f2);
  vec2 s0 = toScreen(p0.xy);
  vec2 s1 = toScreen(p1.xy);
  vec2 s2 = toScreen(p2.xy);
  vec2 tangent = normalize(s2 - s0 + vec2(1e-6, 0.0));
  vec2 normal = vec2(-tangent.y, tangent.x);
  float halfPx = uLineWidth * uPixelRatio * mix(0.3, 1.0, f1 * f1 * f1) * 0.5;
  float reach = halfPx * 2.2 + 1.5;
  vec2 position2 = s1 + normal * aSample.y * reach;
  vDist = aSample.y * reach;
  vHalfPx = halfPx;
  float light = 0.0;
  for (int k = 0; k < 16; k++) {
    vec4 pulse = uPulses[k];
    if (pulse.w <= 0.0) continue;
    float age = uPulseTime - pulse.y;
    if (age < 0.0 || age > 4.0) continue;
    float travel = age * uPulseSpeed;
    float front = abs(x - pulse.x) - travel + 0.05 * sin(u * 7.0 + pulse.y * 3.7) + (seed - 0.5) * 0.025;
    bool wave = pulse.w > 1.5;
    float along = front > 0.0 ? exp(-front * front / 0.0025) : exp(front / (wave ? 0.32 : 0.13));
    along += wave ? 0.0 : 0.45 * exp(-front * front / 0.0012);
    along *= smoothstep(0.0, 0.12, travel);
    float gap = (u - pulse.z) * 13.0;
    float across = wave ? 1.0 : 1.25 * exp(-gap * gap);
    light += along * across * exp(-age * 1.1);
  }
  light = min(light * uPulseStrength, 1.4);
  float tone = u * uStripes * 0.5 + x * 0.09 - uFlow;
  vec3 base = palette(tone);
  float lit = clamp(light, 0.0, 1.0);
  vec3 glowTint = mix(base, vec3(1.0, 0.95, 1.0), lit * 0.45);
  vec3 inkTint = mix(base, labToLinear(uLabDeep), lit * 0.7);
  vColor = mix(glowTint, inkTint, uInk);
  vGain = mix(uBack, 1.0, pow(f1, 1.5)) * (1.0 + light * mix(0.9, 2.2, uInk)) * (1.0 + uEnergy * 0.18);
  gl_Position = vec4(position2 / uResolution * 2.0 - 1.0, 0.0, 1.0);
}
`;

const linesFragmentShader = /* glsl */ `
precision highp float;
uniform float uCore;
in float vDist;
in float vHalfPx;
in vec3 vColor;
in float vGain;
out vec4 fragColor;

void main() {
  float sigma = max(vHalfPx, 0.55);
  float d = vDist / sigma;
  float energy = exp(-d * d) * min(vHalfPx / 0.55, 1.0) * vGain * uCore;
  fragColor = vec4(vColor * energy, energy);
}
`;

const quadVertexShader = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const downsampleShader = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 a = texture(uSource, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 b = texture(uSource, vUv + uTexel * vec2(1.0, -1.0));
  vec4 c = texture(uSource, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 d = texture(uSource, vUv + uTexel * vec2(1.0, 1.0));
  fragColor = (a + b + c + d) * 0.125 + texture(uSource, vUv) * 0.5;
}
`;

const upsampleShader = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uBase;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 sum = texture(uSource, vUv) * 4.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 0.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 0.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(0.0, -1.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(0.0, 1.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, -1.0));
  sum += texture(uSource, vUv + uTexel * vec2(1.0, -1.0));
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 1.0));
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 1.0));
  fragColor = texture(uBase, vUv) + sum / 16.0;
}
`;

const compositeShader = /* glsl */ `
precision highp float;
uniform sampler2D uLines;
uniform sampler2D uBloom;
uniform vec3 uBackground;
uniform vec2 uResolution;
uniform float uGlow;
uniform float uExposure;
uniform float uMode;
uniform float uGrain;
in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec4 lines = texture(uLines, vUv);
  vec4 bloom = texture(uBloom, vUv);
  vec3 color;
  if (uMode < 0.5) {
    vec3 light = (lines.rgb + bloom.rgb * uGlow) * uExposure;
    vec3 exposed = 1.0 - exp(-light);
    float peak = max(exposed.r, max(exposed.g, exposed.b));
    exposed = mix(exposed, vec3(peak), smoothstep(0.75, 1.0, peak) * 0.35);
    vec2 q = vUv - 0.5;
    q.x *= uResolution.x / uResolution.y;
    exposed *= 1.0 - 0.18 * smoothstep(0.35, 1.1, length(q));
    color = uBackground + (1.0 - uBackground) * exposed;
  } else {
    float energy = lines.a + bloom.a * uGlow * 0.2;
    vec3 hue = (lines.rgb + bloom.rgb * uGlow * 0.2) / max(energy, 1e-4);
    float cover = clamp(1.0 - exp(-energy * uExposure * 1.4), 0.0, 0.94);
    color = mix(uBackground, clamp(hue * 0.8, 0.0, 1.0), cover);
  }
  float grain = hash(gl_FragCoord.xy + uGrain * 311.0) - 0.5;
  fragColor = vec4(encode(color) + grain * (1.2 / 255.0), 1.0);
}
`;

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

let canvas2DContext: CanvasRenderingContext2D | null = null;
const parseCssColor = (color: string, fallback: [number, number, number]): [number, number, number] => {
  if (typeof document === 'undefined') return fallback;
  if (!canvas2DContext) {
    const c = document.createElement('canvas');
    canvas2DContext = c.getContext('2d');
  }
  if (!canvas2DContext) return fallback;
  canvas2DContext.fillStyle = '#010203';
  canvas2DContext.fillStyle = color;
  const s = String(canvas2DContext.fillStyle);
  if (s === '#010203' && color.trim().toLowerCase() !== '#010203') return fallback;
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  const match = s.match(/[\d.]+/g);
  if (!match || match.length < 3) return fallback;
  return [Number(match[0]) / 255, Number(match[1]) / 255, Number(match[2]) / 255];
};

const toLinear = (val: number) =>
  val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);

const rgbToOklabArray = ([r, g, b]: [number, number, number]): [number, number, number] => {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

export const InterferenceRibbons = React.forwardRef<
  InterferenceRibbonsHandle,
  InterferenceRibbonsProps
>(function InterferenceRibbons(
  {
    colors = DEFAULT_COLORS,
    backgroundColor = '#0A0A0A',
    mode = 'auto',
    wires = 64,
    lineWidth = 1.6,
    ribbonWidth = 0.24,
    amplitude = 0.6,
    waveLength = 1,
    angle = 42,
    twist = 1.6,
    curl = 0.25,
    depth = 0.65,
    stripes = 2.2,
    colorFlow = 0.04,
    glow = 0.45,
    intensity = 1,
    speed = 0.7,
    spin = 0.35,
    interactive = true,
    hoverPulses = true,
    clickPulse = true,
    pulseSpeed = 1.1,
    pulseStrength = 1,
    hoverBoost = 1,
    paused = false,
    quality = 1,
    className,
    style,
    children,
  },
  ref
) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const controllerRef = React.useRef<{
    sync: () => void;
    destroy: () => void;
    pulse: (pos: number) => void;
  } | null>(null);

  const [reducedMotion, setReducedMotion] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const propsRef = React.useRef({
    colors,
    backgroundColor,
    mode,
    wires,
    lineWidth,
    ribbonWidth,
    amplitude,
    waveLength,
    angle,
    twist,
    curl,
    depth,
    stripes,
    colorFlow,
    glow,
    intensity,
    speed,
    spin,
    interactive,
    hoverPulses,
    clickPulse,
    pulseSpeed,
    pulseStrength,
    hoverBoost,
    paused,
    quality,
    reduced: reducedMotion,
  });

  React.useEffect(() => {
    propsRef.current = {
      colors,
      backgroundColor,
      mode,
      wires,
      lineWidth,
      ribbonWidth,
      amplitude,
      waveLength,
      angle,
      twist,
      curl,
      depth,
      stripes,
      colorFlow,
      glow,
      intensity,
      speed,
      spin,
      interactive,
      hoverPulses,
      clickPulse,
      pulseSpeed,
      pulseStrength,
      hoverBoost,
      paused,
      quality,
      reduced: reducedMotion,
    };
    controllerRef.current?.sync();
  });

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    el.prepend(canvas);

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: false,
        powerPreference: 'high-performance',
      });
    } catch {
      canvas.remove();
      return;
    }

    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose();
      canvas.remove();
      return;
    }

    renderer.autoClear = false;

    const rtType =
      renderer.extensions.has('EXT_color_buffer_float') ||
      renderer.extensions.has('EXT_color_buffer_half_float')
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType;

    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeom = new THREE.PlaneGeometry(2, 2);
    const pulsesArray = Array.from({ length: 16 }, () => new THREE.Vector4(0, -100, 0, 0));

    const lineMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uPulseTime: { value: 0 },
        uAngle: { value: 0 },
        uExtent: { value: 2 },
        uAmplitude: { value: 0.6 },
        uFrequency: { value: 1.55 },
        uHalf: { value: 0.24 },
        uCurl: { value: 0.25 },
        uTwist: { value: 1.6 },
        uSpin: { value: 0 },
        uLineWidth: { value: 1.6 },
        uBack: { value: 0.35 },
        uStripes: { value: 2.2 },
        uFlow: { value: 0 },
        uEnergy: { value: 0 },
        uPulseSpeed: { value: 1.1 },
        uPulseStrength: { value: 1 },
        uInk: { value: 0 },
        uLabDeep: { value: new THREE.Vector3() },
        uLabA: { value: new THREE.Vector3() },
        uLabB: { value: new THREE.Vector3() },
        uPulses: { value: pulsesArray },
        uCore: { value: 0.85 },
      },
      vertexShader,
      fragmentShader: linesFragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });

    const createQuadMaterial = (frag: string, uniforms: Record<string, { value: unknown }>) =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms,
        vertexShader: quadVertexShader,
        fragmentShader: frag,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
      });

    const downsampleMat = createQuadMaterial(downsampleShader, {
      uSource: { value: null },
      uTexel: { value: new THREE.Vector2() },
    });

    const upsampleMat = createQuadMaterial(upsampleShader, {
      uSource: { value: null },
      uBase: { value: null },
      uTexel: { value: new THREE.Vector2() },
    });

    const compositeMat = createQuadMaterial(compositeShader, {
      uLines: { value: null },
      uBloom: { value: null },
      uBackground: { value: new THREE.Vector3() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uGlow: { value: 0.45 },
      uExposure: { value: 1.6 },
      uMode: { value: 0 },
      uGrain: { value: 0 },
    });

    let currentWireCount = 0;
    const lineMesh = new THREE.Mesh(new THREE.BufferGeometry(), lineMat);
    lineMesh.frustumCulled = false;
    const lineScene = new THREE.Scene();
    lineScene.add(lineMesh);

    const quadMesh = new THREE.Mesh(quadGeom, compositeMat);
    quadMesh.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quadMesh);

    const createRT = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
        type: rtType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });

    let linesRT: THREE.WebGLRenderTarget | null = null;
    let downTargets: THREE.WebGLRenderTarget[] = [];
    let upTargets: THREE.WebGLRenderTarget[] = [];
    let destroyed = false;
    let animId = 0;
    let lastTime = 0;
    let isIntersecting = true;
    let ribbonTime = 6;
    let pulseTime = 0;
    let spinAngle = 0;
    let flowOffset = 0;
    let energyLevel = 0;
    let isHovering = false;
    let pulseIndex = 0;
    let widthPx = 1;
    let heightPx = 1;
    let dpr = 1;
    let grainPhase = 0;
    const lastPointer = { x: -1e9, y: -1e9 };

    const cleanupRTs = () => {
      linesRT?.dispose();
      downTargets.forEach((t) => t.dispose());
      upTargets.forEach((t) => t.dispose());
      linesRT = null;
      downTargets = [];
      upTargets = [];
    };

    const renderPass = (mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      quadMesh.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(quadScene, quadCam);
    };

    const computeGeometry = () => {
      const p = propsRef.current;
      const angleRad = (clamp(p.angle, -180, 180) * Math.PI) / 180;
      const extent =
        ((widthPx / Math.max(heightPx, 1)) * Math.abs(Math.cos(angleRad)) +
          Math.abs(Math.sin(angleRad))) *
        1.08;
      return {
        angle: angleRad,
        extent,
        frequency: 1.55 / clamp(p.waveLength, 0.2, 5),
      };
    };

    const renderFrame = () => {
      if (!linesRT || !downTargets.length) return;
      const targetWires = Math.round(clamp(propsRef.current.wires, 4, 160));
      if (targetWires !== currentWireCount) {
        currentWireCount = targetWires;
        lineMesh.geometry.dispose();

        // Build wire geometry
        const vertCount = 361 * targetWires * 8;
        const indexCount = 360 * targetWires * 6;
        const vertexData = new Float32Array(vertCount);
        const indexData = new Uint32Array(indexCount);
        let vIdx = 0;
        let iIdx = 0;
        let randSeed = 1;
        const rng = () => ((randSeed = (16807 * randSeed) % 0x7fffffff) / 0x7fffffff);

        for (let wire = 0; wire < targetWires; wire++) {
          const uCoord = ((wire + 0.5) / targetWires) * 2 - 1;
          const seedVal = rng();
          const baseV = vIdx / 4;
          for (let seg = 0; seg <= 360; seg++) {
            const frac = seg / 360;
            vertexData.set([uCoord, seedVal, frac, -1, uCoord, seedVal, frac, 1], vIdx);
            vIdx += 8;
          }
          for (let seg = 0; seg < 360; seg++) {
            const b = baseV + 2 * seg;
            indexData.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], iIdx);
            iIdx += 6;
          }
        }

        const geom = new THREE.BufferGeometry();
        const buffer = new THREE.InterleavedBuffer(vertexData, 4);
        geom.setAttribute('aWire', new THREE.InterleavedBufferAttribute(buffer, 2, 0));
        geom.setAttribute('aSample', new THREE.InterleavedBufferAttribute(buffer, 2, 2));
        geom.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
        geom.setIndex(new THREE.BufferAttribute(indexData, 1));
        lineMesh.geometry = geom;
      }

      // Update uniforms
      const p = propsRef.current;
      const lu = lineMat.uniforms;
      const resW = widthPx * dpr;
      const resH = heightPx * dpr;
      const { angle: aAngle, extent: aExtent, frequency: aFreq } = computeGeometry();
      const labA = rgbToOklabArray(parseCssColor(p.colors[0], [0.42, 0.24, 1]));
      const labB = rgbToOklabArray(parseCssColor(p.colors[1], [0.83, 0.42, 1]));

      lu.uResolution.value.set(resW, resH);
      lu.uPixelRatio.value = dpr;
      lu.uTime.value = ribbonTime;
      lu.uPulseTime.value = pulseTime;
      lu.uAngle.value = aAngle;
      lu.uExtent.value = aExtent;
      lu.uAmplitude.value = clamp(p.amplitude, 0, 1.5);
      lu.uFrequency.value = aFreq;
      lu.uHalf.value = clamp(p.ribbonWidth, 0.02, 0.8);
      lu.uCurl.value = clamp(p.curl, 0, 1.2);
      lu.uTwist.value = clamp(p.twist, 0, 8);
      lu.uSpin.value = spinAngle;
      lu.uLineWidth.value = clamp(p.lineWidth, 0.4, 6);
      lu.uBack.value = 1 - clamp(p.depth, 0, 1);
      lu.uStripes.value = clamp(p.stripes, 0, 12);
      lu.uFlow.value = flowOffset;
      lu.uEnergy.value = energyLevel;
      lu.uPulseSpeed.value = clamp(p.pulseSpeed, 0.1, 5);
      lu.uPulseStrength.value = clamp(p.pulseStrength, 0, 3);

      const bgRgb = parseCssColor(p.backgroundColor, [0.04, 0.04, 0.04]);
      const bgLum = 0.2126 * bgRgb[0] + 0.7152 * bgRgb[1] + 0.0722 * bgRgb[2];
      const isInk = p.mode === 'ink' || (p.mode === 'auto' && bgLum > 0.5);
      const deepMult = isInk ? 1.15 : 0.85;

      lu.uInk.value = isInk ? 1 : 0;
      lu.uLabDeep.value.set(labA[0] * (isInk ? 0.6 : 0.42), labA[1] * deepMult, labA[2] * deepMult);
      lu.uLabA.value.set(labA[0], labA[1], labA[2]);
      lu.uLabB.value.set(labB[0], labB[1], labB[2]);

      const cu = compositeMat.uniforms;
      cu.uBackground.value.set(toLinear(bgRgb[0]), toLinear(bgRgb[1]), toLinear(bgRgb[2]));
      cu.uResolution.value.set(resW, resH);
      cu.uGlow.value = clamp(p.glow, 0, 3);
      cu.uExposure.value = 1.6 * clamp(p.intensity, 0, 4);
      cu.uMode.value = isInk ? 1 : 0;
      cu.uGrain.value = grainPhase;

      // Render lines to linesRT
      renderer.setRenderTarget(linesRT);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(lineScene, quadCam);

      // Downsample pass
      let currentSource = linesRT;
      for (const target of downTargets) {
        downsampleMat.uniforms.uSource.value = currentSource.texture;
        downsampleMat.uniforms.uTexel.value.set(1 / currentSource.width, 1 / currentSource.height);
        renderPass(downsampleMat, target);
        currentSource = target;
      }

      // Upsample & blur pass
      let currentUpsample = downTargets[downTargets.length - 1];
      for (let i = downTargets.length - 2; i >= 0; i--) {
        upsampleMat.uniforms.uSource.value = currentUpsample.texture;
        upsampleMat.uniforms.uBase.value = downTargets[i].texture;
        upsampleMat.uniforms.uTexel.value.set(1 / currentUpsample.width, 1 / currentUpsample.height);
        renderPass(upsampleMat, upTargets[i]);
        currentUpsample = upTargets[i];
      }

      // Final composite pass to screen
      compositeMat.uniforms.uLines.value = linesRT.texture;
      compositeMat.uniforms.uBloom.value = currentUpsample.texture;
      renderPass(compositeMat, null);
    };

    const animate = (timestamp: number) => {
      animId = 0;
      if (destroyed) return;
      const dt = Math.min(0.05, Math.max(0, (timestamp - lastTime) / 1000));
      lastTime = timestamp;

      const p = propsRef.current;
      const targetEnergy =
        isHovering && p.interactive && !p.reduced ? clamp(p.hoverBoost, 0, 2) : 0;
      energyLevel += (targetEnergy - energyLevel) * (1 - Math.exp(-dt / 0.4));
      pulseTime += dt;

      if (!p.paused && !p.reduced) {
        const effSpeed = clamp(p.speed, -4, 4) * (1 + 0.35 * energyLevel);
        ribbonTime += dt * effSpeed;
        spinAngle += dt * effSpeed * clamp(p.spin, -4, 4);
        flowOffset += dt * effSpeed * clamp(p.colorFlow, -2, 2);
        grainPhase = (grainPhase + 0.618034) % 1;
      }

      renderFrame();

      const activeAnim = !p.paused && !p.reduced;
      const targetHover = isHovering && p.interactive && !p.reduced ? p.hoverBoost : 0;
      const hasActivePulses =
        Math.abs(energyLevel - targetHover) > 0.002 ||
        pulsesArray.some((pulse) => pulse.w > 0 && pulseTime - pulse.y < 4);

      if (isIntersecting && !document.hidden && (activeAnim || hasActivePulses)) {
        animId = requestAnimationFrame(animate);
      }
    };

    const requestFrame = () => {
      if (destroyed || animId || !isIntersecting) return;
      lastTime = performance.now();
      animId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      const rect = el.getBoundingClientRect();
      widthPx = Math.max(1, rect.width);
      heightPx = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2) * clamp(propsRef.current.quality, 0.25, 1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(widthPx, heightPx, false);

      const rw = Math.round(widthPx * dpr);
      const rh = Math.round(heightPx * dpr);
      cleanupRTs();

      linesRT = createRT(rw, rh);
      const passes = clamp(Math.floor(Math.log2(Math.min(rw, rh) / 8)), 3, 7);
      for (let i = 1; i <= passes; i++) {
        downTargets.push(createRT(Math.max(1, rw >> i), Math.max(1, rh >> i)));
        upTargets.push(createRT(Math.max(1, rw >> i), Math.max(1, rh >> i)));
      }

      renderFrame();
      requestFrame();
    };

    const triggerPulse = (x: number, y: number, modeVal: number) => {
      pulsesArray[pulseIndex].set(x, pulseTime, y, modeVal);
      pulseIndex = (pulseIndex + 1) % 16;
      requestFrame();
    };

    const screenToRibbon = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const { angle: radAngle } = computeGeometry();
      const halfH = 0.5 * rect.height;
      const cx = (clientX - rect.left - rect.width / 2) / halfH;
      const cy = -(clientY - rect.top - rect.height / 2) / halfH;
      const cosA = Math.cos(radAngle);
      const sinA = Math.sin(radAngle);
      return {
        x: cosA * cx + sinA * cy,
        y: -sinA * cx + cosA * cy,
      };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const p = propsRef.current;
      if (e.pointerType === 'touch' || !p.interactive) return;
      if (!isHovering) {
        isHovering = true;
        requestFrame();
      }
      if (!p.hoverPulses || p.reduced || Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y) < 50) {
        return;
      }
      const { frequency: freq } = computeGeometry();
      const pos = screenToRibbon(e.clientX, e.clientY);
      const halfW =
        clamp(p.ribbonWidth, 0.02, 0.8) * (1 + 0.22 * Math.sin(0.61 * pos.x - 0.19 * ribbonTime + 1.3));
      const theta = clamp(p.twist, 0, 8) * pos.x + spinAngle;
      const spineY =
        clamp(p.amplitude, 0, 1.5) *
        (0.62 * Math.sin(pos.x * freq + 0.33 * ribbonTime + 0.4) +
          0.26 * Math.sin(pos.x * freq * 1.93 - 0.21 * ribbonTime + 2.1) +
          0.12 * Math.sin(pos.x * freq * 3.07 + 0.47 * ribbonTime + 4.2));
      const distFromSpine = pos.y - spineY;
      if (Math.abs(distFromSpine) > halfW * Math.max(Math.abs(Math.cos(theta)), 0.12) + 0.03) {
        return;
      }
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      const normU = clamp(distFromSpine / (halfW * Math.cos(theta) || 0.001), -1, 1);
      triggerPulse(pos.x, normU, 1);
    };

    const handlePointerLeave = () => {
      isHovering = false;
      lastPointer.x = -1e9;
      requestFrame();
    };

    const handlePointerDown = (e: PointerEvent) => {
      const p = propsRef.current;
      if (e.button === 0 && p.interactive && p.clickPulse && !p.reduced) {
        triggerPulse(screenToRibbon(e.clientX, e.clientY).x, 0, 2);
      }
    };

    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerleave', handlePointerLeave);
    el.addEventListener('pointercancel', handlePointerLeave);
    el.addEventListener('pointerdown', handlePointerDown);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(el);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isIntersecting = entries.some((entry) => entry.isIntersecting);
        if (isIntersecting) requestFrame();
      },
      { rootMargin: '80px' }
    );
    intersectionObserver.observe(el);

    const handleVisibility = () => {
      if (!document.hidden) requestFrame();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleContextLost = (e: Event) => e.preventDefault();
    canvas.addEventListener('webglcontextlost', handleContextLost);

    handleResize();

    controllerRef.current = {
      sync: () => {
        const newDpr =
          Math.min(window.devicePixelRatio || 1, 2) * clamp(propsRef.current.quality, 0.25, 1);
        if (Math.abs(newDpr - dpr) > 0.001) {
          handleResize();
        } else {
          renderFrame();
        }
        requestFrame();
      },
      destroy: () => {
        destroyed = true;
        cancelAnimationFrame(animId);
        el.removeEventListener('pointermove', handlePointerMove);
        el.removeEventListener('pointerleave', handlePointerLeave);
        el.removeEventListener('pointercancel', handlePointerLeave);
        el.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('visibilitychange', handleVisibility);
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        cleanupRTs();
        lineMesh.geometry.dispose();
        quadGeom.dispose();
        [lineMat, downsampleMat, upsampleMat, compositeMat].forEach((m) => m.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      },
      pulse: (fraction = 0.5) => {
        if (propsRef.current.reduced) return;
        const rect = el.getBoundingClientRect();
        triggerPulse(
          screenToRibbon(rect.left + clamp(fraction, 0, 1) * rect.width, rect.top + rect.height / 2).x,
          0,
          2
        );
      },
    };

    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      pulse: (pos = 0.5) => controllerRef.current?.pulse(pos),
    }),
    []
  );

  return (
    <div
      ref={containerRef}
      className={cn('relative isolate h-full min-h-[240px] w-full overflow-hidden', className)}
      style={{ backgroundColor, ...style }}
    >
      {children && <div className="relative z-10 h-full w-full">{children}</div>}
    </div>
  );
});

InterferenceRibbons.displayName = 'InterferenceRibbons';

export default InterferenceRibbons;
