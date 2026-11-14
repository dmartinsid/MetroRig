# Mobile App Context

**Gathered:** 2026-11-14
**Spec:** `.specs/features/mobile-app/spec.md`
**Status:** Ready for design

---

## Feature Boundary

On a phone (window up to 767 px wide) MetroRig fits the screen with no horizontal page scroll and behaves like an installed app: bottom tab bar, a transport bar in the Editor, a scrolling grid with fixed track names, an installable manifest and a screen that stays awake while sound plays. Windows of 768 px and wider keep today's layout.

Request: "Vamos melhorar o visual pra mobile, hoje pra mobile tem algumas coisas estourando na tela. Use todos os seus conhecimentos de especialista de frontend e vamos deixar essa experiencia pro mobile tao boa quanto fosse um app nativo"

---

## Implementation Decisions

### Navigation

- Q1: "Navegação no celular (Editor/Stadium/Grooves/Improv): onde ficam as abas?" User chose "Tab bar fixa embaixo (Recommended)": the four screens become a tab bar fixed to the bottom, icon plus name.

### Editor transport

- Q2: "No Editor, o PLAY e o BPM ficam ~1500px abaixo da grade. Como resolver?" User chose "Barra de transporte fixa (Recommended)": a bar fixed above the tab bar with BPM −, the value, BPM + and Play/Stop. The Tempo Bus card keeps its slider.

### Native-app capabilities

- Q3: "Quais recursos de app nativo entram nesta entrega?" User chose "Instalável (Recommended), Tela não apaga (Recommended)". Vibration and offline were not chosen.

### Sequencer grid

- Q4: "Grade do sequenciador no celular (16+ passos não cabem em 375px):" User chose "Rolagem com rótulos fixos (Recommended)": a narrow fixed column of track names, steps scroll horizontally with snap per beat, a fade on the edge that has more, and the figure palette as one scrolling row of chips.

### Agent's Discretion

- Defaults stated in the spec's Assumptions table; none was asked.

### Declined / Undiscussed Gray Areas → Assumptions

- See the spec's Assumptions table.

---

## Specific References

- "tao boa quanto fosse um app nativo": iOS / Android conventions - bottom tab bar, 44 px touch targets, safe areas, no tap flash, no double-tap zoom.

---

## Deferred Ideas

- Offline play through a service worker (samples run to several MB) - offered in Q3, not chosen.
- Haptic feedback on pads and buttons - offered in Q3, not chosen.
- The grid following the playhead during playback.
