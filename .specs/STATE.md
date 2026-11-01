# Project State

## Decisions

### AD-001
- **Decision**: Interface V2 departs from the Stitch captures wherever they draw a control with no behaviour: the header links, the `tune` and `settings` icons, and the "Meter" selector.
- **Reason**: Q5: "Removemos os quatro links e os dois ícones, ficando só o botão GO TO STADIUM MODE?" Q6: "Mantemos o seletor completo com seus 4 grupos no lugar do Meter?" The user answered "q5 recomendacao q6 recomendacao". A control with no action is worse than none, and a Meter-only selector would strand saved presets.
- **Trade-off**: The header is sparser than the capture.
- **Scope**: interface-v2, header
- **Date**: 2026-10-31
- **Status**: active (AD-001); its removal of the `Editor`, `Stadium` and `Grooves` links is superseded by AD-007

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
- **Status**: active (AD-004); AD-010 makes the exception for songs

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

### AD-007
- **Decision**: The header carries working `Editor`, `Stadium` and `Grooves` links, and the `GO TO STADIUM MODE` toggle is removed. `Presets` stays out.
- **Reason**: Q2: "Os links `Editor`, `Stadium` e `Grooves` entram no header, como na captura, e o botão `GO TO STADIUM MODE` sai?" The user answered "q2 recomendacao". The links now have an action, and the toggle's label has no meaning with three screens.
- **Trade-off**: The captures draw a pill the product no longer has.
- **Scope**: grooves-library, header
- **Date**: 2026-11-01
- **Status**: active (AD-007)

### AD-008
- **Decision**: The Editor grid and the Mute/Solo cards always show all 11 tracks, with lower rows, where `editor.png` draws 4.
- **Reason**: Q14: "A grade e os cards de Mute/Solo mostram sempre as 9 trilhas, com linhas mais baixas?" The user answered "q14 recomendacao", and Q10 raised the count to 11: "coloca o china e sino sim". A collapsed grid would hide parts of a loaded song.
- **Trade-off**: The Editor is taller and denser than the capture.
- **Scope**: grooves-library, Editor
- **Date**: 2026-11-01
- **Status**: active (AD-008)

### AD-009
- **Decision**: The Stadium keeps 4 rings and 4 orbs, grouped as `CLICK`, `KICK`, `SNARE/TOMS` and `CYMBALS`, where `stadium.png` labels them `CLICK`, `KICK`, `SNARE` and `HI-HAT`.
- **Reason**: Q15: "O relógio mantém 4 anéis, agrupando as peças em `CLICK`, `KICK`, `SNARE/TOMS` e `CYMBALS`, e os orbs seguem o mesmo agrupamento?" The user answered "q15 recomendacao, pode ser os grupos senao nao vai caber".
- **Trade-off**: The clock shows less detail than the Editor.
- **Scope**: grooves-library, Stadium
- **Date**: 2026-11-01
- **Status**: active (AD-009)

### AD-010
- **Decision**: A song carries its tempo. Loading one replaces BPM, time signature and drum tracks, and the Grooves screen shows the BPM. The `Groove Library` dropdown keeps AD-004.
- **Reason**: Q9: "Carregar uma música troca o BPM, o compasso e as trilhas de bateria, desliga o Trainer e mostra o BPM na tela?" The user answered "q9 recomendacao". The tempo is part of the song.
- **Trade-off**: Songs and library grooves apply differently.
- **Scope**: grooves-library, songs
- **Date**: 2026-11-01
- **Status**: active (AD-010)
