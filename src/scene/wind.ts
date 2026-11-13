import { type Material, type Mesh, MeshDepthMaterial, RGBADepthPacking } from 'three'

export const windTime = { value: 0 }

const header = /* glsl */ `
uniform float uTime;
attribute float aSway;
#ifdef WIND_FLUTTER
attribute float aPhase;
#endif
float windGust() {
  return 0.6 + 0.4 * sin(uTime * 0.19) * sin(uTime * 0.11 + 1.7);
}
vec3 windOffset(vec3 p, float sway) {
  float gust = windGust();
  float h = max(p.y, 0.0);
  float bend = h * h * 0.0011 * gust * (0.7 + 0.3 * sin(uTime * 0.8));
  float local = sway * 0.012 * gust;
  float phase = dot(p, vec3(0.21, 0.13, 0.17));
  return vec3(1.0, 0.0, 0.35) * bend + local * vec3(
    sin(uTime * 1.7 + phase),
    0.4 * sin(uTime * 2.3 + phase * 1.3),
    0.7 * sin(uTime * 1.3 + phase * 0.8)
  );
}
`

const project = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  #ifdef WIND_FLUTTER
    mvPosition.z += sin(uTime * 5.0 + aPhase) * 0.12 * transformed.y * windGust();
  #endif
  mvPosition = instanceMatrix * mvPosition;
  mvPosition.xyz += windOffset((instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz, aSway);
#else
  mvPosition.xyz += windOffset(mvPosition.xyz, aSway);
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`

function patch(material: Material, flutter: boolean) {
  if (flutter) material.defines = { ...material.defines, WIND_FLUTTER: '' }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime
    shader.vertexShader = header + shader.vertexShader.replace('#include <project_vertex>', project)
  }
  material.customProgramCacheKey = () => `wind-${flutter}`
}

export function addWind(mesh: Mesh, flutter: boolean) {
  patch(mesh.material as Material, flutter)
  mesh.customDepthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  patch(mesh.customDepthMaterial, flutter)
}
