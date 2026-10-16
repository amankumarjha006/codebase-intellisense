import * as React from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { cn } from '../../lib/utils';

export interface DitherProps extends React.HTMLAttributes<HTMLDivElement> {
  waveSpeed?: number;
  waveFrequency?: number;
}

const vertexShader = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // 4x4 Bayer Matrix
  float bayer4(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int index = x + y * 4;
    
    if (index == 0) return 0.0 / 16.0;
    if (index == 1) return 8.0 / 16.0;
    if (index == 2) return 2.0 / 16.0;
    if (index == 3) return 10.0 / 16.0;
    if (index == 4) return 12.0 / 16.0;
    if (index == 5) return 4.0 / 16.0;
    if (index == 6) return 14.0 / 16.0;
    if (index == 7) return 6.0 / 16.0;
    if (index == 8) return 3.0 / 16.0;
    if (index == 9) return 11.0 / 16.0;
    if (index == 10) return 1.0 / 16.0;
    if (index == 11) return 9.0 / 16.0;
    if (index == 12) return 15.0 / 16.0;
    if (index == 13) return 7.0 / 16.0;
    if (index == 14) return 13.0 / 16.0;
    return 5.0 / 16.0;
  }

  void main() {
    vec2 coord = gl_FragCoord.xy;
    vec2 uv = vUv;

    // Subtle wave
    float wave = sin(uv.x * 4.0 + uTime * 0.4) * cos(uv.y * 3.0 + uTime * 0.3) * 0.08 + 0.08;
    
    // Bayer ordered dither threshold
    float threshold = bayer4(coord);
    float color = step(threshold, wave);

    // Ultra soft monochrome opacity
    gl_FragColor = vec4(vec3(0.9), color * 0.05);
  }
`;

export function Dither({ className = '', waveSpeed = 0.5, ...props }: DitherProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let renderer: Renderer | null = null;
    let animId: number = 0;

    try {
      renderer = new Renderer({
        alpha: true,
        dpr: Math.min(window.devicePixelRatio, 2),
      });

      const gl = renderer.gl;
      container.appendChild(gl.canvas);

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [container.clientWidth, container.clientHeight] },
        },
        transparent: true,
      });

      const mesh = new Mesh(gl, { geometry, program });

      const resize = () => {
        if (!container || !renderer) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        program.uniforms.uResolution.value = [width, height];
      };

      window.addEventListener('resize', resize);
      resize();

      let startTime = performance.now();
      const update = (now: number) => {
        const elapsed = (now - startTime) / 1000;
        program.uniforms.uTime.value = elapsed * waveSpeed;
        renderer?.render({ scene: mesh });
        animId = requestAnimationFrame(update);
      };

      animId = requestAnimationFrame(update);

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
        if (gl.canvas && container.contains(gl.canvas)) {
          container.removeChild(gl.canvas);
        }
      };
    } catch (e) {
      // Fallback silently if WebGL is unavailable
      return;
    }
  }, [waveSpeed]);

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden hidden md:block', className)}
      {...props}
    />
  );
}
