# Project State

## Decisions

### AD-001
- **Decision**: Interface V2 departs from the Stitch captures wherever they draw a control with no behaviour: the header links, the `tune` and `settings` icons, and the "Meter" selector.
- **Reason**: Q5: "Removemos os quatro links e os dois ícones, ficando só o botão GO TO STADIUM MODE?" Q6: "Mantemos o seletor completo com seus 4 grupos no lugar do Meter?" The user answered "q5 recomendacao q6 recomendacao". A control with no action is worse than none, and a Meter-only selector would strand saved presets.
- **Trade-off**: The header is sparser than the capture.
- **Scope**: interface-v2, header
- **Date**: 2026-10-31
- **Status**: active (AD-001)

### AD-002
- **Decision**: MetroRig's screens show only real values. Invented telemetry and decorative codes from the captures are removed or replaced by what the app knows.
- **Reason**: Q4: "O rodapé mostra apenas dados reais ... sem versão nem CPU?" Q8: "Removemos SYNC, usamos o nome real do preset em PAT ...?" Q16: "Removemos os dois e mantemos o título TEMPO BUS?" Q17: "Mostramos o tamanho do compasso sobre o limite do motor, como STEPS: 16/32?" The user answered "q4 recomendacao", "q8 ... recomendacoes" and "Recomendacoes". Invented data breaks trust in a product that sells precision.
- **Trade-off**: The status areas read less like hardware than the captures.
- **Scope**: every MetroRig screen
- **Date**: 2026-10-31
- **Status**: active (AD-002)

### AD-003
- **Decision**: The sequencer keeps its beat spacer and sustain state, which the Editor capture does not draw.
- **Reason**: Q14: "Mantemos os dois como diferenças aprovadas em relação à tela?" The user answered "Recomendacoes". Long bars become hard to read without the spacer, and sustain is part of how figures read.
- **Trade-off**: The grid is not pixel-identical to the capture.
- **Scope**: interface-v2, sequencer
- **Date**: 2026-10-31
- **Status**: active (AD-003)

### AD-004
- **Decision**: The groove library shows names without a BPM.
- **Reason**: Q10: "Mostramos os nomes sem BPM e adicionamos o Metalcore Breakdown à biblioteca?" The user answered "Recomendacoes". Applying a groove changes the pattern, not the tempo.
- **Trade-off**: The label differs from the capture's sample.
- **Scope**: interface-v2, groove library
- **Date**: 2026-10-31
- **Status**: active (AD-004)

### AD-005
- **Decision**: Where the two captures disagree, the Editor capture's header wins: `PRO` in capitals and two separate selectors. The toggle uses the PRD and Stadium wording.
- **Reason**: Q5 settled the toggle text as `GO TO STADIUM MODE`, answered "q5 recomendacao". The header pattern was presented in round 2 as a stated default, and the user answered "Recomendacoes". One header must serve both modes.
- **Trade-off**: Each capture loses one detail to the other.
- **Scope**: interface-v2, header
- **Date**: 2026-10-31
- **Status**: active (AD-005)

### AD-006
- **Decision**: A solo dims every silenced row, although `editor.png` draws a lit `S` beside undimmed rows.
- **Reason**: Q15: "A trilha silenciada fica esmaecida na grade, e seu orb não reage." The user answered "Recomendacoes". The capture's `S` is sample state, and the rule the user approved wins.
- **Trade-off**: The Editor picture is taken with no solo, so it shows no lit `S`.
- **Scope**: interface-v2, Mute and Solo
- **Date**: 2026-10-31
- **Status**: active (AD-006)
