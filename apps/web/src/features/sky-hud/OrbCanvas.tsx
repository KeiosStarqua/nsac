import { useEffect, useRef, useState } from "react";
import type { VoicePhase } from "./types";

const VERTEX = `attribute vec2 p; varying vec2 v; void main(){v=p;gl_Position=vec4(p,0.,1.);}`;
const FRAGMENT = `precision highp float;
  varying vec2 v;
  uniform float uTime, uEnergy, uMode;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+13.7;a*=.5;}return v;}
  void main(){
    vec2 p=v*1.05;float r=length(p),t=uTime*(.24+uMode*.11);float angle=atan(p.y,p.x);
    vec2 q=p+vec2(.075*sin(t*.6),.06*cos(t*.51));
    float war=fbm(q*4.1+vec2(t,-t*.4));
    float inner = .33+.15*sin(angle*3.5+t*2.+war*6.)+.10*sin(angle*7.-t*.7);
    float ringA=exp(-pow((r-(.78+.075*sin(angle*2.1+t*.7+war*2.)))*24.,2.));
    float ringB=exp(-pow((r-(.61+.18*sin(angle*2.5-t*.68)+.05*war))*21.,2.));
    float ringC=exp(-pow((r-(.43+.29*sin(angle*1.4+t*.5+war)))*22.,2.));
    float filament=exp(-pow((p.y-(.31*sin(2.7*p.x+t+war*3.)-.15*cos(p.x*5.-t*.55)))*17.,2.));
    float filament2=exp(-pow((p.x-(.30*sin(2.9*p.y-t*.8)+.2*cos(p.y*4.+t*.4)))*14.,2.));
    float shell=1.-smoothstep(.76,.98,r);float fresnel=pow(clamp(r/.97,0.,1.),5.);
    float irregular=fbm(p*3.3+vec2(t*.3,t*.13));
    vec3 deep=vec3(.02,.12,.34);
    vec3 cyan=vec3(.22,.93,1.);
    vec3 blue=vec3(.17,.53,1.);
    vec3 lilac=vec3(.76,.54,1.);
    vec3 col=mix(deep,blue,.34+.22*war);
    col+=cyan*ringA*1.15+blue*ringB*.95+lilac*ringC*.92;
    col+=cyan*filament*.48+mix(cyan,lilac,.5+.5*sin(angle*2.+t))*filament2*.52;
    col+=mix(blue,lilac,smoothstep(-.2,.9,p.x))*fresnel*(.42+.43*irregular);
    col+=vec3(1.,.70,.5)*exp(-length(p-vec2(.49,-.34))*8.)*.47;
    col+=vec3(.32,.95,1.)*exp(-length(p-vec2(-.25,-.77))*8.)*.31;
    col*=.81+uEnergy*.34;
    float rim=exp(-pow((r-.9)*15.,2.));col+=mix(cyan,lilac,smoothstep(-.7,.75,p.x)) *rim*.56;
    float halo=exp(-pow((r-1.)*8.,2.))*.15+exp(-r*r*6.)*.035;
    float alpha=shell*(.37+.18*war+ringA*.45+ringB*.25+ringC*.27+filament*.22)+rim*.43+halo;
    alpha*=1.-smoothstep(.97,1.22,r);
    vec3 glow=col+vec3(.13,.27,.52)*halo;
    gl_FragColor=vec4(glow,clamp(alpha,0.,1.));
  }`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log ?? "Shader compile failed");
  }
  return shader;
}

function modeFor(phase: VoicePhase): number {
  if (phase === "thinking" || phase === "transcribing") return 1.3;
  if (phase === "listening") return 1;
  if (phase === "speaking") return 1.4;
  return 0.2;
}

/**
 * The transparent WebGL orb (WebGL1, no dependencies). `energyRef` is a mutable ref the canvas reads
 * per frame (no React re-render at animation rate). CSS fallback when WebGL is unavailable.
 */
export function OrbCanvas({ phase, energyRef, reducedMotion }: { phase: VoicePhase; energyRef: React.MutableRefObject<number>; reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ phase, reduced: reducedMotion });
  stateRef.current = { phase, reduced: reducedMotion };
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) throw new Error("WebGL unavailable");

      const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
      const program = gl.createProgram();
      if (!program) throw new Error("Could not create program");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Orb shader link failed");
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, "p");
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        time: gl.getUniformLocation(program, "uTime"),
        energy: gl.getUniformLocation(program, "uEnergy"),
        mode: gl.getUniformLocation(program, "uMode"),
      };

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      let last = 0;
      let elapsed = 0;
      let smoothEnergy = 0;
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        if (document.hidden) return;
        if (now - last < 33) return; // ~30 fps is plenty for the orb
        const delta = last ? Math.min((now - last) / 1000, 0.06) : 0.033;
        last = now;
        const { phase: p, reduced: reducedNow } = stateRef.current;
        smoothEnergy += (energyRef.current - smoothEnergy) * 0.13;
        if (!reducedNow) elapsed += delta;
        else elapsed = elapsed;

        const quality = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = Math.round(canvas.clientWidth * quality);
        const height = Math.round(canvas.clientHeight * quality);
        if (width < 1 || height < 1) return;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl!.viewport(0, 0, width, height);
        }
        gl!.clearColor(0, 0, 0, 0);
        gl!.clear(gl!.COLOR_BUFFER_BIT);
        gl!.useProgram(program);
        gl!.uniform1f(uniforms.time, elapsed);
        gl!.uniform1f(uniforms.energy, smoothEnergy);
        gl!.uniform1f(uniforms.mode, modeFor(p));
        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      };
      frame = requestAnimationFrame(tick);
    } catch (error) {
      console.warn("[sky-hud] orb fallback:", error instanceof Error ? error.message : String(error));
      setFallback(true);
    }

    return () => {
      cancelAnimationFrame(frame);
      if (gl) gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (fallback) {
    return <div className="orb-css-fallback" aria-hidden="true" style={{ opacity: 0.9 }} />;
  }
  return <canvas ref={canvasRef} className="orb-canvas" aria-hidden="true" width={440} height={440} />;
}
