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

