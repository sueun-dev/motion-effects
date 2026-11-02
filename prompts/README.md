# Prompts · 프롬프트

[English](#english) · [한국어](#한국어) · [All prompts · 전체 프롬프트](#all-prompts--전체-프롬프트)

## English

Every effect in this repo has a prompt: `prompts/NNN-slug.md`, in English and in Korean. Each one describes the look, the 5-second timeline and the technique in concrete numbers (colours, sizes, counts, timings), the tricks needed to keep it free of flicker, and ends with the same output rules.

**Use one**

1. Open a prompt file and copy the English (or Korean) block. Code blocks on GitHub have a copy button.
2. Paste it into an AI coding assistant. You get one self-contained HTML file with a 1080 × 1920 canvas and a `renderFrame(t)` function; open it in a browser.
3. To turn it into a video, draw `renderFrame(i / 30)` for i = 0 … 149, save each canvas frame as a PNG, then:

```bash
ffmpeg -framerate 30 -i frame%03d.png -c:v libx264 -pix_fmt yuv420p -crf 16 effect.mp4
```

**Add the result to this repo instead**

Append this to the prompt and the answer comes back as an effect file that `npm run render` can use:

```text
Instead of an HTML file, write it as one ES module, effects/NNN-slug.js, for this renderer:
export default { name, ko, ... } with exactly one of
- draw(ctx, t, W, H) for Canvas 2D (the canvas is not cleared between frames, so paint the whole frame), or
- frag: a WebGL2 fragment shader without its header, i.e. your functions and void main() (#version 300 es, precision,
  uTime, uPhase = uTime / 5, uRes, uTex, outColor, snoise() and fbm() are already declared), or
- three(renderer, W, H) returning { scene, camera, update(t) } for three.js (import * as THREE from 'three').
W = 1080, H = 1920, t is in seconds (0 to 5). The renderer adds the title label, so do not draw one.
```

## 한국어

이 repo의 모든 효과에 프롬프트가 있다: `prompts/NNN-slug.md`, 영어와 한국어. 프롬프트마다 모양, 5초 시간표, 기법을 구체적인 숫자(색, 크기, 개수, 타이밍)로 적고, 깜빡임 없이 만드는 데 필요한 요령을 넣고, 끝에 같은 출력 규칙을 붙였다.

**쓰는 법**

1. 프롬프트 파일을 열어 영어(또는 한국어) 블록을 복사한다. GitHub 코드 블록에는 복사 버튼이 있다.
2. AI 코딩 도구에 붙여 넣는다. 1080 × 1920 캔버스와 `renderFrame(t)` 함수가 든 HTML 파일 하나가 나오니 브라우저에서 연다.
3. 영상으로 만들려면 i = 0 … 149에 대해 `renderFrame(i / 30)`을 그려 프레임마다 PNG로 저장한 뒤:

```bash
ffmpeg -framerate 30 -i frame%03d.png -c:v libx264 -pix_fmt yuv420p -crf 16 effect.mp4
```

**결과를 이 repo에 넣으려면**

프롬프트 끝에 아래를 붙이면 `npm run render`로 바로 렌더할 수 있는 효과 파일로 받는다.

```text
HTML 파일 대신, 이 렌더러용 ES 모듈 하나 effects/NNN-slug.js로 작성해 줘:
export default { name, ko, ... }에 아래 중 정확히 하나를 넣는다
- Canvas 2D면 draw(ctx, t, W, H) (캔버스는 프레임 사이에 지워지지 않으니 매 프레임 화면 전체를 칠한다)
- WebGL2 프래그먼트 셰이더면 frag: 머리 부분을 뺀 셰이더, 즉 함수들과 void main() (#version 300 es, precision,
  uTime, uPhase = uTime / 5, uRes, uTex, outColor, snoise(), fbm()은 이미 선언돼 있다)
- three.js면 three(renderer, W, H)가 { scene, camera, update(t) }를 돌려준다 (import * as THREE from 'three')
W = 1080, H = 1920, t는 초 단위(0~5). 제목 라벨은 렌더러가 넣으니 그리지 않는다.
```

## All prompts · 전체 프롬프트

### 1. Design styles · 디자인 스타일

| # | Effect · 효과 |
|---|---|
| 001 | [Liquid Motion · 리퀴드 모션](001-liquid-motion.md) ★ |
| 002 | [Holographic · 홀로그래픽](002-holographic.md) ★ |
| 003 | [Claymorphism · 클레이모피즘](003-claymorphism.md) ★ |
| 004 | [Y2K Chrome · Y2K 크롬](004-y2k-chrome.md) ★ |
| 005 | [Paper Cutout · 페이퍼 컷아웃](005-paper-cutout.md) ★ |
| 006 | [Vaporwave · 베이퍼웨이브](006-vaporwave.md) ★ |
| 007 | [Bauhaus · 바우하우스](007-bauhaus.md) ★ |
| 008 | [Neubrutalism · 뉴브루탈리즘](008-neubrutalism.md) ★ |
| 009 | [Memphis Design · 멤피스 디자인](009-memphis-design.md) ★ |
| 010 | [Grainy Gradient · 그레이니 그라디언트](010-grainy-gradient.md) ★ |
| 011 | [Glassmorphism · 글래스모피즘](011-glassmorphism.md) |
| 012 | [Neumorphism · 뉴모피즘](012-neumorphism.md) |
| 013 | [Aurora Gradient · 오로라 그라디언트](013-aurora-gradient.md) |
| 014 | [Neon Glow · 네온 글로우](014-neon-glow.md) |
| 015 | [Long Shadow · 롱 섀도](015-long-shadow.md) |
| 016 | [Watercolor Bleed · 수채화 번짐](016-watercolor-bleed.md) |
| 017 | [Swiss Style · 스위스 스타일](017-swiss-style.md) |
| 018 | [Pop Art Comic · 팝아트 코믹](018-pop-art-comic.md) |
| 019 | [Op Art · 옵아트](019-op-art.md) |
| 020 | [Sci-fi HUD · SF HUD](020-sci-fi-hud.md) |

### 2. Print, retro & glitch · 인쇄·레트로·글리치

| # | Effect · 효과 |
|---|---|
| 021 | [Halftone · 하프톤](021-halftone.md) ★ |
| 022 | [Duotone · 듀오톤](022-duotone.md) |
| 023 | [Risograph · 리소그래프](023-risograph.md) |
| 024 | [Dithering · 디더링](024-dithering.md) |
| 025 | [ASCII Art · 아스키 아트](025-ascii-art.md) |
| 026 | [Pixel Art · 픽셀 아트](026-pixel-art.md) |
| 027 | [CRT Monitor · CRT 모니터](027-crt-monitor.md) |
| 028 | [Glitch · 글리치](028-glitch.md) ★ |
| 029 | [Pixel Sorting · 픽셀 소팅](029-pixel-sorting.md) |
| 030 | [Moiré · 무아레](030-moire.md) |

### 3. Typography · 타이포그래피

| # | Effect · 효과 |
|---|---|
| 031 | [Kinetic Typography · 키네틱 타이포그래피](031-kinetic-typography.md) ★ |
| 032 | [Text Scramble · 텍스트 스크램블](032-text-scramble.md) ★ |
| 033 | [Typewriter · 타자기 효과](033-typewriter.md) |
| 034 | [Mask Reveal · 마스크 리빌](034-mask-reveal.md) |
| 035 | [Wave Text · 웨이브 텍스트](035-wave-text.md) |
| 036 | [Variable Font · 가변 폰트](036-variable-font.md) |
| 037 | [Text on Path · 패스 텍스트](037-text-on-path.md) |
| 038 | [3D Extruded Text · 3D 돌출 텍스트](038-extruded-3d-text.md) |
| 039 | [Liquid Fill Text · 리퀴드 필 텍스트](039-liquid-fill-text.md) |
| 040 | [Marquee · 마퀴 띠](040-marquee.md) |
| 041 | [Odometer Counter · 숫자 롤링 카운터](041-odometer-counter.md) |
| 042 | [Split-Flap · 스플릿 플랩](042-split-flap.md) |
| 043 | [Knockout Text · 녹아웃 텍스트](043-knockout-text.md) |
| 044 | [Blur Reveal · 블러 리빌](044-blur-reveal.md) |
| 045 | [Echo Text · 에코 텍스트](045-echo-text.md) |
| 046 | [LED Dot Matrix · LED 전광판](046-led-dot-matrix.md) |

### 4. Shaders & generative · 셰이더·제너러티브

| # | Effect · 효과 |
|---|---|
| 047 | [Infinite Zoom · 인피니트 줌](047-infinite-zoom.md) ★ |
| 048 | [Domain Warping · 도메인 워핑](048-domain-warping.md) |
| 049 | [Plasma · 플라스마](049-plasma.md) |
| 050 | [Voronoi · 보로노이](050-voronoi.md) |
| 051 | [Raymarching SDF · 레이마칭 SDF](051-raymarching-sdf.md) |
| 052 | [Julia Fractal · 줄리아 프랙털](052-julia-fractal.md) |
| 053 | [Kaleidoscope · 만화경](053-kaleidoscope.md) |
| 054 | [Tunnel · 터널](054-tunnel.md) |
| 055 | [Water Ripple · 물결 파문](055-water-ripple.md) |
| 056 | [Caustics · 커스틱](056-caustics.md) |
| 057 | [Heat Haze · 아지랑이 왜곡](057-heat-haze.md) |
| 058 | [Fire · 불꽃](058-fire.md) |
| 059 | [Smoke · 연기](059-smoke.md) |
| 060 | [Reaction-Diffusion · 반응 확산](060-reaction-diffusion.md) |
| 061 | [Slit-Scan · 슬릿 스캔](061-slit-scan.md) |
| 062 | [Topographic Contours · 등고선](062-topographic-contours.md) |
| 063 | [Ridgeline · 리지라인](063-ridgeline.md) |
| 064 | [Flow Field · 플로우 필드](064-flow-field.md) |
| 065 | [Truchet Tiles · 트루셰 타일](065-truchet-tiles.md) |
| 066 | [Spirograph · 스피로그래프](066-spirograph.md) |
| 067 | [Fourier Epicycles · 푸리에 원](067-fourier-epicycles.md) |
| 068 | [God Rays · 빛내림](068-god-rays.md) |
| 069 | [Lens Flare · 렌즈 플레어](069-lens-flare.md) |
| 070 | [Audio Visualizer · 오디오 비주얼라이저](070-audio-visualizer.md) |
| 071 | [L-System Growth · L-시스템 성장](071-l-system-growth.md) |
| 072 | [Circle Packing · 원 패킹](072-circle-packing.md) |

### 5. Particles · 파티클

| # | Effect · 효과 |
|---|---|
| 073 | [Fireworks · 불꽃놀이](073-fireworks.md) |
| 074 | [Confetti · 컨페티](074-confetti.md) |
| 075 | [Particle Text · 파티클 텍스트](075-particle-text.md) |
| 076 | [Warp Starfield · 워프 스타필드](076-warp-starfield.md) |
| 077 | [Particle Morph · 파티클 모핑](077-particle-morph.md) |
| 078 | [Galaxy Spiral · 은하 소용돌이](078-galaxy-spiral.md) |
| 079 | [Plexus · 플렉서스](079-plexus.md) |
| 080 | [Bokeh · 보케](080-bokeh.md) |
| 081 | [Embers · 불씨](081-embers.md) |
| 082 | [Boids Swarm · 군집 비행](082-boids-swarm.md) |
| 083 | [Disintegration · 디스인티그레이션](083-disintegration.md) |

### 6. 3D · 3D

| # | Effect · 효과 |
|---|---|
| 084 | [Isometric · 아이소메트릭](084-isometric.md) ★ |
| 085 | [Low Poly · 로우 폴리](085-low-poly.md) ★ |
| 086 | [Wireframe · 와이어프레임](086-wireframe.md) |
| 087 | [Toon Shading · 툰 셰이딩](087-toon-shading.md) |
| 088 | [Glass Refraction · 유리 굴절](088-glass-refraction.md) |
| 089 | [Voxel Build · 복셀 빌드](089-voxel-build.md) |
| 090 | [Exploded View · 분해도](090-exploded-view.md) |
| 091 | [Dolly Zoom · 돌리 줌](091-dolly-zoom.md) |
| 092 | [Cloth Wave · 깃발 물결](092-cloth-wave.md) |
| 093 | [Origami Fold · 오리가미 폴딩](093-origami-fold.md) |
| 094 | [Ribbon Trail · 리본 트레일](094-ribbon-trail.md) |
| 095 | [Parallax Layers · 패럴랙스](095-parallax-layers.md) |
| 096 | [Dissolve · 디졸브 번](096-dissolve.md) |
| 097 | [Domino Chain · 도미노](097-domino-chain.md) |
| 098 | [Pin Art · 핀 아트](098-pin-art.md) |

### 7. Animation principles · 애니메이션 원리

| # | Effect · 효과 |
|---|---|
| 099 | [Squash and Stretch · 스쿼시 앤 스트레치](099-squash-and-stretch.md) ★ |
| 100 | [Shape Morph · 셰이프 모프](100-shape-morph.md) ★ |
| 101 | [Line Animation · 라인 애니메이션](101-line-animation.md) ★ |
| 102 | [Easing Curves · 이징](102-easing-curves.md) |
| 103 | [Anticipation · 예비 동작](103-anticipation.md) |
| 104 | [Follow Through · 팔로우 스루](104-follow-through.md) |
| 105 | [Arc Motion · 아크 모션](105-arc-motion.md) |
| 106 | [Spring Jelly · 스프링 젤리](106-spring-jelly.md) |
| 107 | [Stagger · 스태거](107-stagger.md) |
| 108 | [Smear Frame · 스미어 프레임](108-smear-frame.md) |
| 109 | [Pendulum Wave · 진자 파동](109-pendulum-wave.md) |
| 110 | [Walk Cycle · 걷기 사이클](110-walk-cycle.md) |
| 111 | [IK Tentacle · IK 촉수](111-ik-tentacle.md) |

### 8. UI & interaction · UI·인터랙션

| # | Effect · 효과 |
|---|---|
| 112 | [Skeleton Shimmer · 스켈레톤 시머](112-skeleton-shimmer.md) |
| 113 | [Loading Indicators · 로딩 인디케이터](113-loading-indicators.md) |
| 114 | [Ripple Button · 리플 버튼](114-ripple-button.md) |
| 115 | [Toggle Morph · 토글·아이콘 모프](115-toggle-morph.md) |
| 116 | [Like Burst · 좋아요 버스트](116-like-burst.md) |
| 117 | [Cursor Trail · 커서 트레일](117-cursor-trail.md) |
| 118 | [Spotlight Reveal · 스포트라이트](118-spotlight-reveal.md) |
| 119 | [Scroll Reveal · 스크롤 리빌](119-scroll-reveal.md) |
| 120 | [Card Swipe · 카드 스와이프](120-card-swipe.md) |
| 121 | [Card Flip · 카드 플립](121-card-flip.md) |
| 122 | [Bento Grid · 벤토 그리드](122-bento-grid.md) |
| 123 | [Dynamic Island · 다이내믹 아일랜드](123-dynamic-island.md) |
| 124 | [Border Beam · 보더 빔](124-border-beam.md) |
| 125 | [Chart Animation · 차트 애니메이션](125-chart-animation.md) |
| 126 | [Page Curl · 페이지 넘김](126-page-curl.md) |

### 9. Transitions · 트랜지션

| # | Effect · 효과 |
|---|---|
| 127 | [Wipe · 와이프](127-wipe.md) |
| 128 | [Iris · 아이리스](128-iris.md) |
| 129 | [Clock Wipe · 시계 와이프](129-clock-wipe.md) |
| 130 | [Whip Pan · 휩 팬](130-whip-pan.md) |
| 131 | [Ink Transition · 잉크 트랜지션](131-ink-transition.md) |
| 132 | [Shape Transition · 도형 트랜지션](132-shape-transition.md) |
| 133 | [Pixelate · 픽셀레이트](133-pixelate.md) |
| 134 | [Venetian Blinds · 블라인드](134-venetian-blinds.md) |
| 135 | [Tile Flip · 타일 플립](135-tile-flip.md) |
| 136 | [Light Leak · 라이트 리크](136-light-leak.md) |
| 137 | [Luma Fade · 루마 페이드](137-luma-fade.md) |

### 10. Lighting & shadows · 조명·그림자

| # | Effect · 효과 |
|---|---|
| 138 | [Three-Point Lighting · 3점 조명](138-three-point-lighting.md) |
| 139 | [Flat, Gouraud & Phong · 플랫·고러드·퐁 셰이딩](139-shading-models.md) |
| 140 | [PBR Materials · PBR 재질](140-pbr-materials.md) |
| 141 | [Image-Based Lighting · 이미지 기반 조명](141-image-based-lighting.md) |
| 142 | [Shadow Mapping · 그림자 매핑](142-shadow-mapping.md) |
| 143 | [Soft Shadows · 소프트 섀도](143-soft-shadows.md) |
| 144 | [Ambient Occlusion · 앰비언트 오클루전](144-ambient-occlusion.md) |
| 145 | [Global Illumination · 전역 조명](145-global-illumination.md) |
| 146 | [Many Lights · 다수 광원](146-many-lights.md) |
| 147 | [Area Lights · 면 광원](147-area-lights.md) |
| 148 | [Projected Texture · 투사 텍스처](148-projector-gobo.md) |

### 11. Materials & surface detail · 재질·표면

| # | Effect · 효과 |
|---|---|
| 149 | [Subsurface Scattering · 서브서피스 스캐터링](149-subsurface-scattering.md) |
| 150 | [Thin-Film Iridescence · 박막 간섭](150-thin-film-iridescence.md) |
| 151 | [Car Paint · 카 페인트](151-car-paint.md) |
| 152 | [Anisotropic Metal · 이방성 금속](152-anisotropic-metal.md) |
| 153 | [Velvet Sheen · 벨벳 광택](153-velvet-sheen.md) |
| 154 | [Fresnel Rim · 프레넬 림](154-fresnel-rim.md) |
| 155 | [Matcap · 맷캡](155-matcap.md) |
| 156 | [Normal Mapping · 노멀 매핑](156-normal-mapping.md) |
| 157 | [Parallax Occlusion Mapping · 시차 차폐 매핑](157-parallax-occlusion-mapping.md) |
| 158 | [Displacement Mapping · 디스플레이스먼트 매핑](158-displacement-mapping.md) |
| 159 | [Triplanar Mapping · 트라이플래너 매핑](159-triplanar-mapping.md) |
| 160 | [Solid Texture · 솔리드 텍스처](160-solid-texture.md) |
| 161 | [Shell Fur · 셸 털](161-shell-fur.md) |
| 162 | [Decal Projection · 데칼 투영](162-decal-projection.md) |

### 12. Reflection, refraction & ray tracing · 반사·굴절·레이 트레이싱

| # | Effect · 효과 |
|---|---|
| 163 | [Planar Reflection · 평면 반사](163-planar-reflection.md) |
| 164 | [Screen-Space Reflections · 스크린 스페이스 반사](164-screen-space-reflections.md) |
| 165 | [Dynamic Cube Map · 동적 큐브맵](165-dynamic-cube-map.md) |
| 166 | [Ray Tracing · 레이 트레이싱](166-ray-tracing.md) |
| 167 | [Prism Dispersion · 프리즘 분산](167-prism-dispersion.md) |
| 168 | [Infinity Mirror · 무한 거울](168-infinity-mirror.md) |
| 169 | [Stencil Portal · 스텐실 포털](169-stencil-portal.md) |

### 13. Atmosphere & volumes · 대기·볼륨

| # | Effect · 효과 |
|---|---|
| 170 | [Volumetric Clouds · 볼류메트릭 구름](170-volumetric-clouds.md) |
| 171 | [Atmospheric Scattering · 대기 산란](171-atmospheric-scattering.md) |
| 172 | [Distance & Height Fog · 거리·높이 안개](172-height-fog.md) |
| 173 | [Volumetric Spotlight · 볼류메트릭 스포트라이트](173-volumetric-spotlight.md) |
| 174 | [Volumetric Fireball · 볼류메트릭 화염구](174-volumetric-fireball.md) |
| 175 | [Nebula · 성운](175-nebula.md) |
| 176 | [Gravitational Lensing · 중력 렌즈](176-gravitational-lensing.md) |
| 177 | [Underwater · 수중](177-underwater.md) |

### 14. Geometry & modeling · 지오메트리·모델링

| # | Effect · 효과 |
|---|---|
| 178 | [Subdivision Surface · 서브디비전 서피스](178-subdivision-surface.md) |
| 179 | [Lathe · 회전체](179-lathe.md) |
| 180 | [Sweep & Loft · 스윕·로프트](180-sweep-loft.md) |
| 181 | [CSG Boolean · 불리언 연산](181-csg-boolean.md) |
| 182 | [Parametric Surfaces · 매개변수 곡면](182-parametric-surfaces.md) |
| 183 | [Marching Cubes · 마칭 큐브](183-marching-cubes.md) |
| 184 | [Bézier Patch · 베지어 곡면](184-bezier-patch.md) |
| 185 | [UV Unwrap · UV 펼치기](185-uv-unwrap.md) |
| 186 | [Point Cloud · 포인트 클라우드](186-point-cloud.md) |
| 187 | [Gaussian Splatting · 가우시안 스플래팅](187-gaussian-splatting.md) |
| 188 | [GPU Instancing · GPU 인스턴싱](188-gpu-instancing.md) |
| 189 | [Voronoi Fracture · 보로노이 파쇄](189-voronoi-fracture.md) |

### 15. Simulation & physics · 시뮬레이션·물리

| # | Effect · 효과 |
|---|---|
| 190 | [Rigid Body · 강체 물리](190-rigid-body.md) |
| 191 | [Soft Body · 소프트 바디](191-soft-body.md) |
| 192 | [Cloth Drape · 천 드레이프](192-cloth-drape.md) |
| 193 | [Particle Fluid · 입자 유체](193-particle-fluid.md) |
| 194 | [Ocean Waves · 바다 파도](194-ocean-waves.md) |
| 195 | [Rope & Chain · 로프·체인](195-verlet-rope.md) |
| 196 | [N-Body Gravity · 다체 중력](196-n-body-gravity.md) |
| 197 | [Granular Sand · 모래 입자](197-granular-sand.md) |

### 16. Nature & procedural worlds · 자연·절차적 세계

| # | Effect · 효과 |
|---|---|
| 198 | [Procedural Terrain · 절차적 지형](198-procedural-terrain.md) |
| 199 | [Grass Field · 잔디밭](199-grass-field.md) |
| 200 | [Tree Growth · 나무 성장](200-tree-growth.md) |
| 201 | [Procedural City · 절차적 도시](201-procedural-city.md) |
| 202 | [Procedural Planet · 절차적 행성](202-procedural-planet.md) |
| 203 | [Water Surface · 물 표면](203-water-surface.md) |
| 204 | [Wave Function Collapse · 파동 함수 붕괴](204-wave-function-collapse.md) |
| 205 | [3D Phyllotaxis · 3D 잎차례](205-phyllotaxis-3d.md) |

### 17. Raymarching & fractals · 레이마칭·프랙털

| # | Effect · 효과 |
|---|---|
| 206 | [Mandelbulb · 만델벌브](206-mandelbulb.md) |
| 207 | [Menger Sponge · 멩거 스펀지](207-menger-sponge.md) |
| 208 | [Mandelbox · 만델박스](208-mandelbox.md) |
| 209 | [Domain Repetition · 도메인 반복](209-domain-repetition.md) |
| 210 | [Quaternion Julia · 쿼터니언 줄리아](210-quaternion-julia.md) |
| 211 | [Sierpinski Tetrahedron · 시에르핀스키 사면체](211-sierpinski-tetrahedron.md) |
| 212 | [Apollonian Fractal · 아폴로니안 프랙털](212-apollonian-fractal.md) |
| 213 | [4D Tesseract · 4차원 테서랙트](213-tesseract-4d.md) |
| 214 | [Cave Fly-through · 동굴 비행](214-cave-flythrough.md) |

### 18. Animation & characters · 애니메이션·캐릭터

| # | Effect · 효과 |
|---|---|
| 215 | [Skeletal Skinning · 스켈레탈 스키닝](215-skeletal-skinning.md) |
| 216 | [Morph Targets · 모프 타깃](216-morph-targets.md) |
| 217 | [Procedural Walk · 절차적 보행](217-procedural-walk.md) |
| 218 | [Crowd Simulation · 군중 시뮬레이션](218-crowd-simulation.md) |
| 219 | [GPU Particles · GPU 파티클](219-gpu-particles.md) |
| 220 | [Gimbal Lock · 짐벌 락](220-gimbal-lock.md) |
| 221 | [Mesh Deformers · 메시 변형](221-mesh-deformers.md) |

### 19. Camera & lens · 카메라·렌즈

| # | Effect · 효과 |
|---|---|
| 222 | [Turntable · 턴테이블](222-turntable.md) |
| 223 | [Depth of Field · 피사계 심도](223-depth-of-field.md) |
| 224 | [Motion Blur · 모션 블러](224-motion-blur.md) |
| 225 | [Tilt-Shift · 틸트 시프트](225-tilt-shift.md) |
| 226 | [Little Planet · 리틀 플래닛](226-little-planet.md) |
| 227 | [Perspective ↔ Orthographic · 원근 ↔ 직교](227-perspective-orthographic.md) |
| 228 | [Anaglyph 3D · 애너글리프 입체](228-anaglyph-3d.md) |
| 229 | [Bullet Time · 불릿 타임](229-bullet-time.md) |
| 230 | [Camera Rail · 카메라 레일](230-camera-rail.md) |

### 20. Rendering & stylization · 렌더링·스타일화

| # | Effect · 효과 |
|---|---|
| 231 | [HDR Tone Mapping · HDR 톤 매핑](231-tone-mapping.md) |
| 232 | [Bloom · 블룸](232-bloom.md) |
| 233 | [G-Buffer · G-버퍼](233-g-buffer.md) |
| 234 | [Rasterization · 래스터화](234-rasterization.md) |
| 235 | [3D Pixel Art · 3D 픽셀 아트](235-pixel-art-3d.md) |
| 236 | [Hatching · 해칭](236-hatching.md) |
| 237 | [Gooch Shading · 구치 셰이딩](237-gooch-shading.md) |
| 238 | [Painterly · 페인터리](238-painterly-kuwahara.md) |
| 239 | [Blueprint · 블루프린트](239-blueprint.md) |

### 21. Art movements & styles · 예술 사조·스타일

| # | Effect · 효과 |
|---|---|
| 240 | [Art Deco · 아르데코](240-art-deco.md) |
| 241 | [Art Nouveau · 아르누보](241-art-nouveau.md) |
| 242 | [Constructivism · 구성주의](242-constructivism.md) |
| 243 | [Ukiyo-e · 우키요에](243-ukiyo-e.md) |
| 244 | [Grunge · 그런지](244-grunge.md) |
| 245 | [Collage · 콜라주](245-collage.md) |
| 246 | [Kawaii · 카와이](246-kawaii.md) |

### 22. Generative math · 제너러티브 수학

| # | Effect · 효과 |
|---|---|
| 247 | [Game of Life · 라이프 게임](247-game-of-life.md) |
| 248 | [Diffusion-Limited Aggregation · 확산 응집](248-dla.md) |
| 249 | [Differential Growth · 차등 성장](249-differential-growth.md) |
| 250 | [Physarum · 점균](250-physarum.md) |
| 251 | [Lorenz Attractor · 로렌츠 끌개](251-lorenz-attractor.md) |
| 252 | [Fractal Flame · 프랙탈 플레임](252-fractal-flame.md) |
| 253 | [Penrose Tiling · 펜로즈 타일링](253-penrose-tiling.md) |
| 254 | [Islamic Geometric Pattern · 이슬람 기하 문양](254-islamic-pattern.md) |
| 255 | [Hyperbolic Tiling · 쌍곡 타일링](255-hyperbolic-tiling.md) |
| 256 | [Hilbert Curve · 힐베르트 곡선](256-hilbert-curve.md) |
| 257 | [TSP Art · TSP 한붓그리기](257-tsp-art.md) |
| 258 | [String Art · 스트링 아트](258-string-art.md) |

### 23. Film & animation craft · 영상·애니메이션 기법

| # | Effect · 효과 |
|---|---|
| 259 | [Rotoscoping · 로토스코핑](259-rotoscoping.md) |
| 260 | [Stop Motion · 스톱모션](260-stop-motion.md) |
| 261 | [Match Cut · 매치 컷](261-match-cut.md) |
| 262 | [Color Grading · 색 보정 (LUT)](262-color-grading.md) |
| 263 | [Rolling Shutter · 롤링 셔터](263-rolling-shutter.md) |
| 264 | [Ink Wash · 수묵화 렌더링](264-ink-wash.md) |

### 24. Physics & characters · 물리·캐릭터

| # | Effect · 효과 |
|---|---|
| 265 | [Ragdoll · 래그돌](265-ragdoll.md) |
| 266 | [Vehicle Physics · 차량 물리](266-vehicle-physics.md) |
| 267 | [Buoyancy · 부력](267-buoyancy.md) |
| 268 | [Motion Matching · 모션 매칭](268-motion-matching.md) |
| 269 | [Lip Sync · 립싱크](269-lip-sync.md) |
| 270 | [Retargeting · 리타기팅](270-retargeting.md) |

### 25. Spatial illusions · 공간 착시

| # | Effect · 효과 |
|---|---|
| 271 | [Anamorphic Billboard · 아나모픽 빌보드](271-anamorphic-billboard.md) |
| 272 | [Projection Mapping · 프로젝션 매핑](272-projection-mapping.md) |
| 273 | [Lenticular · 렌티큘러](273-lenticular.md) |
| 274 | [Zoetrope · 조이트로프](274-zoetrope.md) |
| 275 | [Virtual Production · 버추얼 프로덕션](275-virtual-production.md) |

### 26. AI-era techniques · AI 시대 기법

| # | Effect · 효과 |
|---|---|
| 276 | [Style Transfer · 스타일 트랜스퍼](276-style-transfer.md) |
| 277 | [Relighting · 리라이팅](277-relighting.md) |
| 278 | [AR Face Filter · AR 얼굴 필터](278-ar-face-filter.md) |

### 27. Retro 3D · 레트로 3D

| # | Effect · 효과 |
|---|---|
| 279 | [Mode 7 · 모드 7](279-mode-7.md) |
| 280 | [Raycasting · 레이캐스팅](280-raycasting.md) |
| 281 | [Voxel Space · 복셀 스페이스](281-voxel-space.md) |
| 282 | [Pseudo-3D Road · 유사 3D 도로](282-pseudo-3d-road.md) |
| 283 | [Sprite Stacking · 스프라이트 스태킹](283-sprite-stacking.md) |
| 284 | [Impostors · 임포스터](284-impostors.md) |

### 28. Rendering internals · 렌더링 내부

| # | Effect · 효과 |
|---|---|
| 285 | [Level of Detail (LOD) · 상세도 단계](285-level-of-detail.md) |
| 286 | [Frustum & Occlusion Culling · 절두체·가림 컬링](286-frustum-culling.md) |
| 287 | [Bounding Volume Hierarchy · 경계 볼륨 계층](287-bvh.md) |
| 288 | [Mipmapping · 밉매핑](288-mipmapping.md) |
| 289 | [Anti-Aliasing · 안티앨리어싱](289-anti-aliasing.md) |

### 29. Shading tricks · 셰이딩 기법

| # | Effect · 효과 |
|---|---|
| 290 | [Hair Strands · 헤어 스트랜드](290-hair-strands.md) |
| 291 | [Eye Shader · 눈 셰이더](291-eye-shader.md) |
| 292 | [Interior Mapping · 인테리어 매핑](292-interior-mapping.md) |
| 293 | [Retroreflection · 재귀반사](293-retroreflection.md) |
| 294 | [Edge Wear · 엣지 마모](294-edge-wear.md) |
| 295 | [IES Light Profiles · IES 배광](295-ies-light-profiles.md) |

### 30. Modeling craft · 모델링 기법

| # | Effect · 효과 |
|---|---|
| 296 | [Digital Sculpting · 디지털 스컬핑](296-digital-sculpting.md) |
| 297 | [Retopology · 리토폴로지](297-retopology.md) |
| 298 | [Kitbashing · 킷배싱](298-kitbashing.md) |
| 299 | [Convex Hull · 볼록 껍질](299-convex-hull.md) |
| 300 | [Gyroid · 자이로이드](300-gyroid.md) |
| 301 | [Topology Optimization · 위상 최적화](301-topology-optimization.md) |
| 302 | [Photogrammetry · 포토그래메트리](302-photogrammetry.md) |
| 303 | [Bas-Relief · 부조](303-bas-relief.md) |

### 31. Physical phenomena · 물리 현상

| # | Effect · 효과 |
|---|---|
| 304 | [Ferrofluid · 자성 유체](304-ferrofluid.md) |
| 305 | [Double Pendulum · 이중 진자](305-double-pendulum.md) |
| 306 | [Hydraulic Erosion · 수력 침식](306-hydraulic-erosion.md) |
| 307 | [Lightning · 번개](307-lightning.md) |
| 308 | [Chladni Patterns · 클라드니 도형](308-chladni-patterns.md) |
| 309 | [Tensegrity · 텐세그리티](309-tensegrity.md) |

### 32. Capture & camera rigs · 캡처·촬영 장비

| # | Effect · 효과 |
|---|---|
| 310 | [Motion Capture · 모션 캡처](310-motion-capture.md) |
| 311 | [Split Diopter · 스플릿 디옵터](311-split-diopter.md) |
| 312 | [Snorricam · 스노리캠](312-snorricam.md) |

### 33. Classic optical illusions · 고전 착시

| # | Effect · 효과 |
|---|---|
| 313 | [Ames Room · 에임스 방](313-ames-room.md) |
| 314 | [Pepper's Ghost · 페퍼의 유령](314-peppers-ghost.md) |
| 315 | [Impossible Object · 불가능한 도형](315-impossible-object.md) |
| 316 | [Shadow Art · 그림자 아트](316-shadow-art.md) |
| 317 | [Hollow-Face Illusion · 할로 페이스 착시](317-hollow-face.md) |
| 318 | [Ambiguous Cylinder · 모호한 원기둥 착시](318-ambiguous-cylinder.md) |

### 34. Art & craft · 예술·공예

| # | Effect · 효과 |
|---|---|
| 319 | [Cubism · 입체파](319-cubism.md) |
| 320 | [Surrealism · 초현실주의](320-surrealism.md) |
| 321 | [Chiaroscuro · 키아로스쿠로](321-chiaroscuro.md) |
| 322 | [Kintsugi · 킨츠기](322-kintsugi.md) |
| 323 | [Pop-up Book · 팝업북](323-pop-up-book.md) |
| 324 | [Lithophane · 리토판](324-lithophane.md) |
| 325 | [Kinetic Sculpture · 키네틱 조각](325-kinetic-sculpture.md) |
