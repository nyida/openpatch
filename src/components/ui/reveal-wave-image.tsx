'use client';

import * as THREE from 'three';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

/* =========================================================
   RevealWaveImage - ported from AuditGPT
   - B&W dither look
   - Soft living shimmer (no side-to-side warp)
   - No mouse interaction
   ========================================================= */

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uPixelSize;
  uniform float uShimmer;
  uniform float uShadow;
  uniform float uMid;
  uniform float uLift;

  varying vec2 vUv;

  float bayer4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;

    float pattern[16];
    pattern[0] = 0.0;    pattern[1] = 8.0;    pattern[2] = 2.0;    pattern[3] = 10.0;
    pattern[4] = 12.0;   pattern[5] = 4.0;    pattern[6] = 14.0;   pattern[7] = 6.0;
    pattern[8] = 3.0;    pattern[9] = 11.0;   pattern[10] = 1.0;  pattern[11] = 9.0;
    pattern[12] = 15.0;  pattern[13] = 7.0;   pattern[14] = 13.0; pattern[15] = 5.0;

    for (int i = 0; i < 16; i++) {
      if (i == index) return pattern[i] / 16.0;
    }
    return 0.0;
  }

  void main() {
    vec4 color = texture2D(uTexture, vUv);
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    gray = clamp(gray + uLift, 0.0, 1.0);

    float shimmer = sin(uTime * 0.55) * 0.035 * uShimmer;
    vec2 pixelCoord = floor(gl_FragCoord.xy / uPixelSize);
    float dither = bayer4x4(pixelCoord);

    float adjusted = gray + (dither - 0.5) * 0.5 + shimmer;

    float quantized;
    if (adjusted < 0.33) {
      quantized = uShadow;
    } else if (adjusted < 0.66) {
      quantized = uMid;
    } else {
      quantized = 1.0;
    }

    gl_FragColor = vec4(vec3(quantized), color.a);
  }
`;

interface ImagePlaneProps {
  src: string;
  aspectRatio: number;
  pixelSize: number;
  shimmer: number;
  shadow: number;
  mid: number;
  lift: number;
}

function ImagePlane({
  src,
  aspectRatio,
  pixelSize,
  shimmer,
  shadow,
  mid,
  lift,
}: ImagePlaneProps) {
  const texture = useLoader(THREE.TextureLoader, src, (loader) => {
    loader.setCrossOrigin('anonymous');
  });
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uTime: { value: 0 },
      uPixelSize: { value: pixelSize },
      uShimmer: { value: shimmer },
      uShadow: { value: shadow },
      uMid: { value: mid },
      uLift: { value: lift },
    }),
    [texture, pixelSize, shimmer, shadow, mid, lift],
  );

  const scale = useMemo<[number, number, number]>(() => {
    const s = Math.max(viewport.width / (2 * aspectRatio), viewport.height / 2);
    return [s * aspectRatio, s, 1];
  }, [aspectRatio, viewport.width, viewport.height]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} scale={scale}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export interface RevealWaveImageProps {
  src: string;
  pixelSize?: number;
  shimmer?: number;
  shadow?: number;
  mid?: number;
  lift?: number;
  className?: string;
}

export function RevealWaveImage({
  src,
  pixelSize = 2,
  shimmer = 1,
  shadow = 0,
  mid = 0.5,
  lift = 0,
  className = 'h-full w-full',
}: RevealWaveImageProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    };
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {aspectRatio !== null ? (
        <Canvas
          style={{ width: '100%', height: '100%', display: 'block' }}
          gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 1] }}
          dpr={[1, 1.5]}
        >
          <Suspense fallback={null}>
            <ImagePlane
              src={src}
              aspectRatio={aspectRatio}
              pixelSize={pixelSize}
              shimmer={shimmer}
              shadow={shadow}
              mid={mid}
              lift={lift}
            />
          </Suspense>
        </Canvas>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}
