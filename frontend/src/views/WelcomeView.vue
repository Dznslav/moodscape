<template>
  <div ref="containerRef" class="welcome-container">
    <div
      class="content-overlay"
      :class="{ 'content-overlay--scrollable': stage === 'selector' }"
    >
      <div class="welcome-shell" :class="{ 'welcome-shell--selector': stage === 'selector' }">
        <div
          class="brand-block"
          :class="{
            'brand-block--visible': isVisible,
            'brand-block--compact': stage === 'selector',
          }"
        >
          <p class="subtitle">{{ $t('welcome.heroSubtitle') }}</p>
          <h1 class="title">Moodscape</h1>

          <div class="hero-actions" :class="{ 'hero-actions--hidden': stage === 'selector' }">
            <button type="button" class="cta-button" @click="openSelector">
              {{ $t('welcome.start') }} <span class="arrow" aria-hidden="true">&#8594;</span>
            </button>
          </div>
        </div>

        <div
          class="selector-stage"
          :class="{ 'selector-stage--visible': stage === 'selector' && isVisible }"
        >
          <div class="selector-card">
            <div class="selector-copy">

              <h2 class="selector-title">{{ $t('welcome.selectorTitle') }}</h2>
              <p class="selector-text">{{ $t('welcome.selectorText') }}</p>
            </div>

            <div class="selector-flow">
              <section class="selector-panel selector-panel--mood">
                <div class="selector-panel__heading">
                  <span class="orbit-field__eyebrow">{{ $t('dashboard.mood') }}</span>
                  <span class="orbit-field__hint">{{ $t('welcome.chooseMood') }}</span>
                </div>

                <div class="linear-picker linear-picker--mood">
                  <button
                    v-for="node in moodNodes"
                    :key="`mood-${node.value}`"
                    type="button"
                    class="linear-option"
                    :class="{ 'linear-option--active': selectedMood === node.value }"
                    :style="{
                      '--node-color': node.color,
                      '--node-fill': node.fill,
                      '--node-stroke': node.stroke,
                    }"
                    :aria-label="node.label"
                    :aria-pressed="selectedMood === node.value"
                    @click="selectMood(node.value)"
                  >
                    <span class="linear-option__emoji">{{ node.emoji }}</span>
                  </button>
                </div>

                <div class="selection-core selection-core--mood">
                  <span class="selection-core__label">{{ $t('welcome.chooseMood') }}</span>
                  <strong class="selection-core__value">
                    <template v-if="selectedMood">
                      {{ moodEmojis[selectedMood - 1] }} {{ selectedMoodLabel }}
                    </template>
                    <template v-else>
                      {{ selectedMoodLabel }}
                    </template>
                  </strong>
                </div>

                <div class="scale-labels scale-labels--orbit">
                  <span>{{ $t('dashboard.moodTerrible') }}</span>
                  <span>{{ $t('dashboard.moodExcellent') }}</span>
                </div>
              </section>

              <section
                class="selector-panel selector-panel--energy"
                :class="{ 'selector-panel--visible': isEnergyStageVisible }"
              >
                <div class="selector-panel__heading">
                  <span class="orbit-field__eyebrow">{{ $t('dashboard.energy') }}</span>
                  <span class="orbit-field__hint">{{ $t('welcome.chooseEnergy') }}</span>
                </div>

                <div class="linear-picker linear-picker--energy">
                  <button
                    v-for="node in energyNodes"
                    :key="`energy-${node.value}`"
                    type="button"
                    class="linear-option"
                    :class="{ 'linear-option--active': selectedEnergy === node.value }"
                    :style="{
                      '--node-color': node.color,
                      '--node-fill': node.fill,
                      '--node-stroke': node.stroke,
                    }"
                    :aria-label="node.label"
                    :aria-pressed="selectedEnergy === node.value"
                    @click="selectEnergy(node.value)"
                  >
                    <span class="linear-option__emoji">{{ node.emoji }}</span>
                  </button>
                </div>

                <div class="selection-core selection-core--energy">
                  <span class="selection-core__label">{{ $t('welcome.chooseEnergy') }}</span>
                  <strong class="selection-core__value">
                    <template v-if="selectedEnergy">
                      {{ energyEmojis[selectedEnergy - 1] }} {{ selectedEnergyLabel }}
                    </template>
                    <template v-else>
                      {{ selectedEnergyLabel }}
                    </template>
                  </strong>
                </div>

                <div class="scale-labels scale-labels--orbit">
                  <span>{{ $t('dashboard.energyExhausted') }}</span>
                  <span>{{ $t('dashboard.energyFull') }}</span>
                </div>
              </section>
            </div>

            <div
              class="selector-actions"
              :class="{ 'selector-actions--visible': isEnergyStageVisible }"
            >
              <button
                type="button"
                class="cta-button cta-button--solid"
                :disabled="!canContinue"
                @click="goToRegister"
              >
                {{ $t('welcome.createAccount') }}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="welcome-login-link"
          :class="{ 'welcome-login-link--visible': stage === 'selector' }"
          @click="goToLogin"
        >
          {{ $t('welcome.existingAccount') }} <span>{{ $t('welcome.login') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import * as THREE from 'three';
import { useOnboardingStore } from '../stores/onboarding';
import { energyColors, energyEmojis, moodColors, moodEmojis } from '../utils/recordPresentation';
import { playHaptic } from '../utils/haptics';

const router = useRouter();
const { t } = useI18n();
const onboardingStore = useOnboardingStore();

const containerRef = ref(null);
const isVisible = ref(false);
const stage = ref('hero');
const selectedMood = ref(null);
const selectedEnergy = ref(null);

const moodLabels = computed(() => [
  t('moods.awful'),
  t('moods.bad'),
  t('moods.meh'),
  t('moods.good'),
  t('moods.super'),
]);

const energyLabels = computed(() =>
  Array.from({ length: 5 }, (_, index) => t(`dashboard.energyLevel${index + 1}`))
);

const moodNodes = computed(() =>
  moodEmojis.map((emoji, index) => ({
    color: moodColors[index],
    emoji,
    fill: `${moodColors[index]}24`,
    label: moodLabels.value[index],
    stroke: `${moodColors[index]}88`,
    value: index + 1,
  }))
);

const energyNodes = computed(() =>
  energyEmojis.map((emoji, index) => ({
    color: energyColors[index],
    emoji,
    fill: `${energyColors[index]}24`,
    label: energyLabels.value[index],
    stroke: `${energyColors[index]}88`,
    value: index + 1,
  }))
);

const canContinue = computed(
  () => Number.isInteger(selectedMood.value) && Number.isInteger(selectedEnergy.value)
);
const isEnergyStageVisible = computed(() => Number.isInteger(selectedMood.value));

const selectedMoodLabel = computed(() =>
  selectedMood.value ? moodLabels.value[selectedMood.value - 1] : t('welcome.moodPlaceholder')
);

const selectedEnergyLabel = computed(() =>
  selectedEnergy.value
    ? energyLabels.value[selectedEnergy.value - 1]
    : t('welcome.energyPlaceholder')
);

const openSelector = () => {
  if (stage.value === 'selector') {
    return;
  }

  stage.value = 'selector';
  playHaptic('openPanel');
};

const selectMood = (value) => {
  const shouldOpenEnergy = !Number.isInteger(selectedMood.value);

  if (selectedMood.value === value) {
    return;
  }

  selectedMood.value = value;
  playHaptic('picker');

  if (shouldOpenEnergy) {
    playHaptic('openPanel');
  }
};

const selectEnergy = (value) => {
  if (selectedEnergy.value === value) {
    return;
  }

  selectedEnergy.value = value;
  playHaptic('picker');
};

const goToRegister = () => {
  if (!canContinue.value) {
    return;
  }

  onboardingStore.setIntroDraft({
    mood: selectedMood.value,
    energy: selectedEnergy.value,
  });

  playHaptic('submit');
  void router.push('/register');
};

const goToLogin = () => {
  playHaptic('secondaryNav');
  void router.push('/login');
};

let renderer, scene, camera, clock, animFrameId, mesh;
let handleResize;
let introTimerId;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  uniform vec3 uColor5;
  uniform vec3 uColor6;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform float uGrainIntensity;
  uniform vec3 uDarkNavy;
  uniform float uGradientSize;
  uniform float uGradientCount;
  uniform float uColor1Weight;
  uniform float uColor2Weight;

  varying vec2 vUv;

  float grain(vec2 uv, float time) {
    vec2 grainUv = uv * uResolution * 0.5;
    float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
    return grainValue * 2.0 - 1.0;
  }

  vec3 getGradientColor(vec2 uv, float time) {
    float gradientRadius = uGradientSize;

    vec2 center1  = vec2(0.5 + sin(time*uSpeed*0.4)*0.4,  0.5 + cos(time*uSpeed*0.5)*0.4);
    vec2 center2  = vec2(0.5 + cos(time*uSpeed*0.6)*0.5,  0.5 + sin(time*uSpeed*0.45)*0.5);
    vec2 center3  = vec2(0.5 + sin(time*uSpeed*0.35)*0.45, 0.5 + cos(time*uSpeed*0.55)*0.45);
    vec2 center4  = vec2(0.5 + cos(time*uSpeed*0.5)*0.4,  0.5 + sin(time*uSpeed*0.4)*0.4);
    vec2 center5  = vec2(0.5 + sin(time*uSpeed*0.7)*0.35,  0.5 + cos(time*uSpeed*0.6)*0.35);
    vec2 center6  = vec2(0.5 + cos(time*uSpeed*0.45)*0.5,  0.5 + sin(time*uSpeed*0.65)*0.5);
    vec2 center7  = vec2(0.5 + sin(time*uSpeed*0.55)*0.38, 0.5 + cos(time*uSpeed*0.48)*0.42);
    vec2 center8  = vec2(0.5 + cos(time*uSpeed*0.65)*0.36, 0.5 + sin(time*uSpeed*0.52)*0.44);
    vec2 center9  = vec2(0.5 + sin(time*uSpeed*0.42)*0.41, 0.5 + cos(time*uSpeed*0.58)*0.39);
    vec2 center10 = vec2(0.5 + cos(time*uSpeed*0.48)*0.37, 0.5 + sin(time*uSpeed*0.62)*0.43);
    vec2 center11 = vec2(0.5 + sin(time*uSpeed*0.68)*0.33, 0.5 + cos(time*uSpeed*0.44)*0.46);
    vec2 center12 = vec2(0.5 + cos(time*uSpeed*0.38)*0.39, 0.5 + sin(time*uSpeed*0.56)*0.41);

    float influence1  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center1));
    float influence2  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center2));
    float influence3  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center3));
    float influence4  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center4));
    float influence5  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center5));
    float influence6  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center6));
    float influence7  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center7));
    float influence8  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center8));
    float influence9  = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center9));
    float influence10 = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center10));
    float influence11 = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center11));
    float influence12 = 1.0 - smoothstep(0.0, gradientRadius, length(uv - center12));

    vec2 rotatedUv1 = uv - 0.5;
    float angle1 = time * uSpeed * 0.15;
    rotatedUv1 = vec2(rotatedUv1.x*cos(angle1) - rotatedUv1.y*sin(angle1),
                      rotatedUv1.x*sin(angle1) + rotatedUv1.y*cos(angle1)) + 0.5;

    vec2 rotatedUv2 = uv - 0.5;
    float angle2 = -time * uSpeed * 0.12;
    rotatedUv2 = vec2(rotatedUv2.x*cos(angle2) - rotatedUv2.y*sin(angle2),
                      rotatedUv2.x*sin(angle2) + rotatedUv2.y*cos(angle2)) + 0.5;

    float radialInfluence1 = 1.0 - smoothstep(0.0, 0.8, length(rotatedUv1 - 0.5));
    float radialInfluence2 = 1.0 - smoothstep(0.0, 0.8, length(rotatedUv2 - 0.5));

    vec3 color = vec3(0.0);
    color += uColor1 * influence1  * (0.55 + 0.45*sin(time*uSpeed))       * uColor1Weight;
    color += uColor2 * influence2  * (0.55 + 0.45*cos(time*uSpeed*1.2))   * uColor2Weight;
    color += uColor3 * influence3  * (0.55 + 0.45*sin(time*uSpeed*0.8))   * uColor1Weight;
    color += uColor4 * influence4  * (0.55 + 0.45*cos(time*uSpeed*1.3))   * uColor2Weight;
    color += uColor5 * influence5  * (0.55 + 0.45*sin(time*uSpeed*1.1))   * uColor1Weight;
    color += uColor6 * influence6  * (0.55 + 0.45*cos(time*uSpeed*0.9))   * uColor2Weight;

    if (uGradientCount > 6.0) {
      color += uColor1 * influence7  * (0.55 + 0.45*sin(time*uSpeed*1.4)) * uColor1Weight;
      color += uColor2 * influence8  * (0.55 + 0.45*cos(time*uSpeed*1.5)) * uColor2Weight;
      color += uColor3 * influence9  * (0.55 + 0.45*sin(time*uSpeed*1.6)) * uColor1Weight;
      color += uColor4 * influence10 * (0.55 + 0.45*cos(time*uSpeed*1.7)) * uColor2Weight;
    }
    if (uGradientCount > 10.0) {
      color += uColor5 * influence11 * (0.55 + 0.45*sin(time*uSpeed*1.8)) * uColor1Weight;
      color += uColor6 * influence12 * (0.55 + 0.45*cos(time*uSpeed*1.9)) * uColor2Weight;
    }

    color += mix(uColor1, uColor3, radialInfluence1) * 0.45 * uColor1Weight;
    color += mix(uColor2, uColor4, radialInfluence2) * 0.4  * uColor2Weight;

    color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;

    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luminance), color, 1.35);
    color = pow(color, vec3(0.92));

    float brightness1 = length(color);
    float mixFactor1 = max(brightness1 * 1.2, 0.15);
    color = mix(uDarkNavy, color, mixFactor1);

    float maxBrightness = 1.0;
    float brightness = length(color);
    if (brightness > maxBrightness) {
      color = color * (maxBrightness / brightness);
    }

    return color;
  }

  void main() {
    vec2 uv = vUv;

    vec3 color = getGradientColor(uv, uTime);

    float grainValue = grain(uv, uTime);
    color += grainValue * uGrainIntensity;

    float timeShift = uTime * 0.5;
    color.r += sin(timeShift) * 0.02;
    color.g += cos(timeShift * 1.4) * 0.02;
    color.b += sin(timeShift * 1.2) * 0.02;

    float brightness2 = length(color);
    float mixFactor2 = max(brightness2 * 1.2, 0.15);
    color = mix(uDarkNavy, color, mixFactor2);

    color = clamp(color, vec3(0.0), vec3(1.0));

    float maxBrightness = 1.0;
    float brightness = length(color);
    if (brightness > maxBrightness) {
      color = color * (maxBrightness / brightness);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vUv = uv;
  }
`;

onMounted(() => {
  const container = containerRef.value;
  if (!container) {
    return;
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, stencil: false, depth: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e27);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.z = 50;
  clock = new THREE.Clock();

  const fov = (camera.fov * Math.PI) / 180;
  const h = Math.abs(camera.position.z * Math.tan(fov / 2) * 2);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uColor1: { value: new THREE.Vector3(0.945, 0.353, 0.133) },
    uColor2: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
    uColor3: { value: new THREE.Vector3(0.945, 0.353, 0.133) },
    uColor4: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
    uColor5: { value: new THREE.Vector3(0.945, 0.353, 0.133) },
    uColor6: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
    uSpeed: { value: 0.6 },
    uIntensity: { value: 1.8 },
    uGrainIntensity: { value: 0.08 },
    uDarkNavy: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
    uGradientSize: { value: 0.45 },
    uGradientCount: { value: 12.0 },
    uColor1Weight: { value: 0.5 },
    uColor2Weight: { value: 1.8 },
  };

  const geo = new THREE.PlaneGeometry(h * camera.aspect, h);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  const tick = () => {
    animFrameId = requestAnimationFrame(tick);
    uniforms.uTime.value += Math.min(clock.getDelta(), 0.1);
    renderer.render(scene, camera);
  };
  tick();

  handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    const newH = Math.abs(camera.position.z * Math.tan((camera.fov * Math.PI / 180) / 2) * 2);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(newH * camera.aspect, newH);
  };
  window.addEventListener('resize', handleResize);

  introTimerId = window.setTimeout(() => {
    isVisible.value = true;
  }, 200);
});

onBeforeUnmount(() => {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
  }
  if (introTimerId) {
    window.clearTimeout(introTimerId);
  }
  if (handleResize) {
    window.removeEventListener('resize', handleResize);
  }

  if (mesh) {
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material?.dispose?.());
    } else {
      mesh.material?.dispose?.();
    }
    scene?.remove(mesh);
    mesh = null;
  }

  const canvas = renderer?.domElement ?? null;
  renderer?.dispose();
  canvas?.remove?.();
  scene = null;
  camera = null;
  clock = null;
  renderer = null;
});
</script>

<style scoped>
.welcome-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
}

.content-overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  overflow: hidden;
}

.content-overlay--scrollable {
  overflow-y: auto;
  pointer-events: auto;
  -webkit-overflow-scrolling: touch;
}

.welcome-shell {
  --shell-pad-inline: clamp(1rem, 4vw, 2rem);
  --shell-pad-top: 0px;
  --shell-pad-bottom: 0px;
  position: relative;
  width: min(100%, 74rem);
  min-height: 100dvh;
  margin: 0 auto;
  padding: var(--shell-pad-top) var(--shell-pad-inline) var(--shell-pad-bottom);
}

.welcome-shell--selector {
  --shell-pad-top: clamp(1.5rem, 4vw, 2.75rem);
  --shell-pad-bottom: max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem));
}

.brand-block {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(46rem, calc(100% - 2rem));
  max-width: calc(100% - 2rem);
  padding-inline: 0.5rem;
  box-sizing: border-box;
  text-align: center;
  pointer-events: auto;
  opacity: 0;
  transform: translate(-50%, calc(-50% + 28px));
  transition:
    top 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    width 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.brand-block--visible {
  opacity: 1;
  transform: translate(-50%, -50%);
}

.brand-block--compact {
  top: clamp(1.35rem, 4vw, 2.25rem);
  width: min(100%, 24rem);
}

.brand-block--compact.brand-block--visible {
  transform: translate(-50%, 0);
}

.subtitle {
  margin: 0 0 1rem;
  font-family: 'Inter', sans-serif;
  font-size: clamp(0.72rem, 1.6vw, 0.95rem);
  font-weight: 500;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.62);
  transition: margin 0.5s ease, letter-spacing 0.5s ease, opacity 0.35s ease;
}

.brand-block--compact .subtitle {
  margin-bottom: 0.55rem;
  letter-spacing: 0.16em;
  opacity: 0.75;
}

.title {
  margin: 0;
  font-family: 'Syne', 'Inter', sans-serif;
  font-size: clamp(3.6rem, 11vw, 8.5rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.94;
  color: white;
  text-shadow: 0 16px 60px rgba(0, 0, 0, 0.42);
  transition:
    font-size 0.75s cubic-bezier(0.16, 1, 0.3, 1),
    text-shadow 0.45s ease;
}

.brand-block--compact .title {
  font-size: clamp(2.4rem, 6vw, 4rem);
  text-shadow: 0 8px 32px rgba(0, 0, 0, 0.34);
}

.hero-actions {
  margin-top: 2.25rem;
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.38s ease,
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.hero-actions--hidden {
  opacity: 0;
  transform: translateY(-18px) scale(0.96);
  pointer-events: none;
}

.selector-stage {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - var(--shell-pad-top) - var(--shell-pad-bottom));
  padding-top: clamp(16rem, 32vh, 19rem);
  padding-bottom: max(6rem, calc(env(safe-area-inset-bottom) + 5rem));
  opacity: 0;
  transform: translateY(22px) scale(0.94);
  transform-origin: top center;
  transition:
    opacity 0.45s ease,
    transform 0.72s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.selector-stage--visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.selector-card {
  position: relative;
  width: min(100%, 38rem);
  margin-inline: auto;
  padding: clamp(1.25rem, 3vw, 1.85rem);
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03)),
    rgba(8, 12, 33, 0.36);
  box-shadow: 0 26px 90px rgba(0, 0, 0, 0.26);
  backdrop-filter: blur(26px);
  -webkit-backdrop-filter: blur(26px);
}

.selector-card::before {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: calc(2rem - 1px);
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.12), transparent 32%),
    radial-gradient(circle at bottom right, rgba(241, 90, 34, 0.14), transparent 30%);
  pointer-events: none;
}

.selector-copy,
.selector-flow,
.selector-actions {
  position: relative;
  z-index: 1;
}

.selector-copy {
  max-width: 38rem;
}

.selector-kicker {
  margin: 0 0 0.55rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
}

.selector-title {
  margin: 0;
  font-family: 'Syne', 'Inter', sans-serif;
  font-size: clamp(1.9rem, 4vw, 2.9rem);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.035em;
  color: white;
}

.selector-text {
  margin: 0.75rem 0 0;
  font-family: 'Inter', sans-serif;
  font-size: 0.98rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.74);
}

.selector-flow {
  display: grid;
  gap: 1rem;
  margin: 1.45rem 0 1.2rem;
}

.selector-panel {
  padding: 1rem;
  border-radius: 1.6rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    rgba(255, 255, 255, 0.025);
}

.selector-panel--energy {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: -0.4rem;
  transform: translateY(-12px);
  transition:
    opacity 0.35s ease,
    max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    padding 0.35s ease,
    margin 0.35s ease;
}

.selector-panel--energy.selector-panel--visible {
  opacity: 1;
  max-height: 18rem;
  padding-top: 1rem;
  padding-bottom: 1rem;
  margin-top: 0;
  transform: translateY(0);
}

.selector-panel__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.8rem;
}

.orbit-field__eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.56);
}

.orbit-field__hint {
  font-family: 'Inter', sans-serif;
  font-size: 0.84rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.84);
}

.linear-picker {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.15rem;
  justify-items: center;
}

.linear-option {
  width: 100%;
  max-width: 5rem;
  min-height: 4.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--node-stroke);
  background: var(--node-fill);
  color: white;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    background 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
  aspect-ratio: 1 / 1;
}

.linear-option:hover {
  transform: translateY(-2px) scale(1.04);
}

.linear-option--active {
  background: var(--node-color);
  border-color: transparent;
  box-shadow: 0 18px 42px var(--node-fill);
  transform: translateY(-2px) scale(1.08);
}

.linear-option__emoji {
  font-size: 1.5rem;
  line-height: 1;
}

.selection-core {
  margin-top: 0.9rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: #0a0e27;
  text-align: center;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
}

.selection-core--mood {
  box-shadow: 0 18px 42px rgba(241, 90, 34, 0.18);
}

.selection-core--energy {
  box-shadow: 0 18px 42px rgba(14, 165, 233, 0.18);
}

.selection-core__label {
  display: block;
  margin-bottom: 0.28rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(10, 14, 39, 0.52);
}

.selection-core__value {
  display: block;
  font-family: 'Inter', sans-serif;
  font-size: 0.97rem;
  font-weight: 700;
  line-height: 1.2;
}

.scale-labels--orbit {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.8rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.74rem;
  color: rgba(255, 255, 255, 0.56);
}

.selector-actions {
  display: flex;
  justify-content: center;
  opacity: 0;
  transform: translateY(14px);
  pointer-events: none;
  transition:
    opacity 0.35s ease,
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.selector-actions--visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.cta-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 2.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #0a0e27;
  background: rgba(255, 255, 255, 0.94);
  border: none;
  border-radius: 999px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.34);
  transition:
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.3s ease,
    background 0.2s ease,
    opacity 0.2s ease;
}

.cta-button:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.38);
  background: white;
}

.cta-button--solid {
  width: min(100%, 24rem);
  color: white;
  background: linear-gradient(135deg, #f15a22, #ff7b42);
  box-shadow: 0 18px 42px rgba(241, 90, 34, 0.34);
}

.cta-button--solid:hover:not(:disabled) {
  background: linear-gradient(135deg, #f36b34, #ff8a57);
}

.cta-button:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
}

.arrow {
  display: inline-block;
  transition: transform 0.3s ease;
}

.cta-button:hover:not(:disabled) .arrow {
  transform: translateX(4px);
}

.welcome-login-link {
  position: absolute;
  left: 50%;
  bottom: max(1.15rem, env(safe-area-inset-bottom));
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.85rem 1.1rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  font-family: 'Inter', sans-serif;
  font-size: 0.94rem;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transform: translate(-50%, 18px);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.45s ease,
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    background 0.2s ease;
}

.welcome-login-link span {
  color: white;
  font-weight: 700;
}

.welcome-login-link--visible {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.welcome-login-link:hover {
  background: rgba(255, 255, 255, 0.12);
}

@media (max-width: 920px) {
  .selector-stage {
    padding-top: clamp(15rem, 28vh, 18rem);
  }
}

@media (max-width: 640px) {
  .welcome-shell {
    --shell-pad-inline: 0.9rem;
  }

  .title {
    font-size: clamp(3rem, 15vw, 5rem);
  }

  .brand-block--compact {
    width: min(100%, 18rem);
  }

  .brand-block--compact .title {
    font-size: clamp(2.15rem, 12vw, 3rem);
  }

  .selector-stage {
    align-items: flex-start;
    padding-top: clamp(13.5rem, 24vh, 15rem);
    padding-bottom: max(6.4rem, calc(env(safe-area-inset-bottom) + 4.8rem));
  }

  .selector-card {
    border-radius: 1.65rem;
    padding: 1rem;
  }

  .selector-title {
    font-size: clamp(1.65rem, 8vw, 2.2rem);
  }

  .selector-text {
    font-size: 0.93rem;
  }

  .selector-panel {
    padding: 0.9rem;
  }

  .selector-panel__heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2rem;
  }

  .linear-picker {
    gap: 0.5rem;
  }

  .linear-option {
    min-height: 3.6rem;
  }

  .linear-option__emoji {
    font-size: 1.35rem;
  }

  .selection-core__value {
    font-size: 0.92rem;
  }

  .welcome-login-link {
    width: calc(100% - 1.8rem);
    justify-content: center;
    text-align: center;
  }
}
</style>
