# 121 · Card Flip · 카드 플립

<img src="../previews/121-card-flip.webp" width="270" alt="Card Flip preview">

**EN** A glossy 3D credit card turns over in perspective to show its back with the card details, lifting toward the camera, then flips back.  
**KO** 광택 있는 3D 신용카드가 카메라 쪽으로 들리며 원근감 있게 뒤집혀 카드 정보가 있는 뒷면을 보였다가 다시 돌아온다.

[Video (mp4)](../videos/121-card-flip.mp4) · [Code](../effects/121-card-flip.js) · UI & interaction · UI·인터랙션

## Prompt (English)

```text
Create a "Card Flip" motion effect: a glossy portrait credit card turns over around its vertical axis in 3D perspective, lifting toward the camera, with studio reflections sliding across it; then it turns back.

Look
- Background: vertical gradient #191B33 to #2C1B3D with a soft violet glow (rgba(150,110,255,0.35) → 0) centred just below the middle.
- Camera: perspective, 40° vertical FOV, at z = 23. Card 6.4 × 10.1 units (about 735 × 1160 px on screen), corner radius 0.5, thickness 0.05, centred 0.6 units below the middle.
- Build the card from two rounded-rectangle planes (front at +0.025, back at −0.025 and rotated 180°) with canvas textures (1024 × 1616), plus a thin extruded side wall in light silver #D9D4E8 (metalness 0.7, roughness 0.3). Faces: physical material, roughness 0.5, metalness 0.05, clearcoat 0.5 (clearcoat roughness 0.4).
- Lighting: a studio room environment map (intensity 0.45) for the reflections, a white key light 1.2 from upper left front (−6, 8, 12), ambient 0.4.
- Front texture: diagonal gradient #20245A → #5A2D91 → #E2577E with three soft white glows; "NOVA" in Futura 700 at the top left; contactless waves (three white arcs, 12 px) at the top right; a gold chip (gradient #F7DE9C → #C9A04E, 200 × 150, radius 26, with a thin cross); "PLATINUM" (Helvetica Neue 500, white 75 %) and "KIM HANEUL" (600, white) near the bottom left; two overlapping circles #FF5F6D and #FFB84C (r 80, 90 % opacity) at the bottom right.
- Back texture: gradient #272B5E → #3B1F5E; a black #0C0C16 magnetic stripe running top to bottom near the left edge; "CARD NUMBER" label; the number in Menlo as four stacked groups "5284", "1937", "6620", "1093"; "VALID THRU" "08/29" and "CVC" "417"; a light #ECEAF2 signature strip with "Kim Haneul" in italic Didot (#5A4E7A); small "고객센터 1588-0000" and "NOVA BANK" in white 50 %.
- A soft shadow behind the card: a blurred rounded rectangle on a plane at z −2.5, offset down-right, opacity 0.45.
- Caption overlay (Apple SD Gothic Neo): "NOVA 플래티넘 카드" (700, 46 px, white 92 %) centred at y 1790; under it at y 1846 (500, 34 px, white 60 %) "앞면" cross-fading to "뒷면 · 카드 정보" while the back faces us.

Motion (0–5 s)
- Two half-turns: k1 = easeInOut over 0.7–2.1 s, k2 = easeInOut over 3.15–4.55 s. Y rotation = π (k1 + k2), so front → back → front (a full turn by the end).
- lift = sin(π k1) + sin(π k2): the card moves 2.2 units toward the camera mid-flip and rolls 0.04 rad.
- Idle sway on the loop (a = 2π t / 5): X rotation 0.07 sin a, extra Y rotation 0.12 sin(a + 1).
- The shadow narrows with the turn (x scale 0.12 + 0.88 |cos(turn)|) and fades to 0.25 while lifted.

Technique
- three.js. The flip is fast, so add motion blur instead of letting it strobe: render 9 sub-frames spread over ±0.025 s around t into a multisampled half-float render target and blend them on screen with a full-screen quad (opacity 1 / (k + 1) for sub-frame k, a running average).

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"카드 플립" 모션 효과를 만들어 줘: 광택 있는 세로형 신용카드가 3D 원근감 속에서 세로축을 중심으로 뒤집히며 카메라 쪽으로 들리고, 스튜디오 반사광이 표면을 미끄러지듯 지나간 뒤 다시 돌아오는 효과.

모양
- 배경: 세로 그라디언트 #191B33 → #2C1B3D, 가운데 조금 아래에 부드러운 보라 빛(rgba(150,110,255,0.35) → 0).
- 카메라: 원근, 세로 시야각 40°, z = 23. 카드 6.4 × 10.1 단위(화면에서 약 735 × 1160 px), 모서리 반지름 0.5, 두께 0.05, 가운데보다 0.6 단위 아래.
- 카드는 둥근 사각형 평면 두 장(앞면 +0.025, 뒷면 −0.025에 180° 회전)에 캔버스 텍스처(1024 × 1616)를 입히고, 얇게 돌출한 옆면을 밝은 은색 #D9D4E8(metalness 0.7, roughness 0.3)로 만든다. 면 재질: physical, roughness 0.5, metalness 0.05, clearcoat 0.5(clearcoat roughness 0.4).
- 조명: 반사용 스튜디오 방 환경맵(세기 0.45), 왼쪽 위 앞 (−6, 8, 12)의 흰 키 라이트 1.2, 앰비언트 0.4.
- 앞면 텍스처: 대각선 그라디언트 #20245A → #5A2D91 → #E2577E에 부드러운 흰 빛 세 개. 왼쪽 위 "NOVA"(Futura 700). 오른쪽 위 비접촉 결제 물결(흰 호 세 개, 12 px). 금색 칩(그라디언트 #F7DE9C → #C9A04E, 200 × 150, 반지름 26, 가는 십자선). 왼쪽 아래 "PLATINUM"(Helvetica Neue 500, 75 % 흰색)과 "KIM HANEUL"(600, 흰색). 오른쪽 아래 겹친 원 두 개 #FF5F6D, #FFB84C(반지름 80, 불투명도 90 %).
- 뒷면 텍스처: 그라디언트 #272B5E → #3B1F5E. 왼쪽 가장자리 근처에 위아래로 이어진 검은 #0C0C16 마그네틱 띠. "CARD NUMBER" 라벨, Menlo로 네 줄 쌓은 번호 "5284", "1937", "6620", "1093". "VALID THRU" "08/29", "CVC" "417". 밝은 #ECEAF2 서명란에 이탤릭 Didot "Kim Haneul"(#5A4E7A). 작은 "고객센터 1588-0000", "NOVA BANK"(50 % 흰색).
- 카드 뒤 부드러운 그림자: z −2.5 평면에 흐린 둥근 사각형, 오른쪽 아래로 비켜서, 불투명도 0.45.
- 자막 오버레이(Apple SD Gothic Neo): "NOVA 플래티넘 카드"(700, 46 px, 92 % 흰색) y 1790 가운데. 그 아래 y 1846(500, 34 px, 60 % 흰색)에 "앞면"이, 뒷면이 보일 때는 "뒷면 · 카드 정보"로 교차 페이드.

움직임 (0–5초)
- 반 바퀴 두 번: k1 = 0.7–2.1초 easeInOut, k2 = 3.15–4.55초 easeInOut. Y 회전 = π (k1 + k2) 이라서 앞 → 뒤 → 앞(끝나면 한 바퀴).
- lift = sin(π k1) + sin(π k2): 뒤집히는 중간에 카드가 카메라 쪽으로 2.2 단위 다가오고 0.04 rad 기운다.
- 루프에 맞춘 잔잔한 흔들림(a = 2π t / 5): X 회전 0.07 sin a, Y 회전 추가 0.12 sin(a + 1).
- 그림자는 회전에 따라 좁아지고(x 배율 0.12 + 0.88 |cos(회전)|) 들릴 때 0.25까지 옅어진다.

기법
- three.js. 뒤집기가 빨라서 번쩍이며 끊겨 보이지 않도록 모션 블러를 넣는다: t 주변 ±0.025초에 걸친 서브프레임 9장을 멀티샘플 half-float 렌더 타깃에 그리고, 전체 화면 사각형으로 화면에 섞는다(서브프레임 k의 불투명도 1 / (k + 1), 누적 평균).

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
