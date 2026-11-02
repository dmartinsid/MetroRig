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
- **Status**: active (AD-002); `song-bars` changes `STEPS` to the pattern's total over 128, user: "recomendacoes"

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
- **Status**: active (AD-007); chord-pads adds `Improv` as a fourth link

### AD-008
- **Decision**: The Editor grid and the Mute/Solo cards always show all 11 tracks, with lower rows, where `editor.png` draws 4.
- **Reason**: Q14: "A grade e os cards de Mute/Solo mostram sempre as 9 trilhas, com linhas mais baixas?" The user answered "q14 recomendacao", and Q10 raised the count to 11: "coloca o china e sino sim". A collapsed grid would hide parts of a loaded song.
- **Trade-off**: The Editor is taller and denser than the capture.
- **Scope**: grooves-library, Editor
- **Date**: 2026-11-01
- **Status**: active (AD-008); AD-012 raises the count to 13

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

### AD-011
- **Decision**: `measureLength` always means the steps of one bar. A pattern is `bars` × `measureLength`, `bars` is 1 when absent, and `gridData` holds the whole pattern.
- **Reason**: Beats, the clock, figures, the Trainer and the time signature all reason about one bar. A `measureLength` of 64 would make each of them learn the difference.
- **Trade-off**: Code that walks a whole pattern must use `patternLength`, not `measureLength`.
- **Scope**: every pattern, engine included
- **Date**: 2026-11-01
- **Status**: active (AD-011)

### AD-012
- **Decision**: MetroRig has 13 tracks. `Mid Tom` (id 11) and `Low Tom` (id 12) sit between `High Tom` and `Floor Tom` in the grid, and join `SNARE/TOMS` in the Stadium. Existing ids do not change.
- **Reason**: Q3: "Ficamos com a A, deixando a B para uma feature separada?" The user answered "vamos pra 13 trilhas", choosing option B over the recommendation. Q9, on the order and the Stadium group, was answered "recomendacoes".
- **Trade-off**: The Editor is taller still. Grid order no longer follows id order.
- **Scope**: house-kit, every track list. Supersedes the count of 11 in AD-008; AD-009 keeps its 4 groups
- **Date**: 2026-11-01
- **Status**: active (AD-012)

### AD-013
- **Decision**: The House Kit ships without written terms. `public/kit/LICENSE.md` records the kit, its author's channel and the release for general use as the user reported it from the video.
- **Reason**: Q1: "Podemos usar o kit e registrar `Unconfirmed: no terms on record`...?" The user answered "vamos usar, no video o rapaz liberou pra uso geral, agradecer a ele e ao canal dele pelo sons." The zip and the product pages state no terms, and the video's transcript could not be read.
- **Trade-off**: The written record rests on the user's account of the video. It departs from Q19 of grooves-library, which refused SM Drums for having no written terms.
- **Scope**: house-kit, kit license
- **Date**: 2026-11-01
- **Status**: active (AD-013)

### AD-014
- **Decision**: All drum samples together may take up to 20 MB, up from 10 MB.
- **Reason**: Q6: "Ficamos com a A?" (20 MB, keeping 3 takes). The user answered "recomendacoes". Four toms at 3 dynamics × 3 takes need about 16.6 MB in all.
- **Trade-off**: The first load takes longer, and fetches 54 new files.
- **Scope**: house-kit, kit size
- **Date**: 2026-11-01
- **Status**: active (AD-014)

### AD-015
- **Decision**: Kick mixes `Blend`, `Close` above 2 kHz and `Room` at half level. Snare mixes `Blend`, lined-up `Close` and `Room` at half level. One gain per piece keeps its loudest take at full scale, and Kick's trim is 0.85. Toms stay on `Blend` alone.
- **Reason**: The user asked for more impact, as a trigger would give. Doubling a sample only raises its level, so different sources are summed. User: "Vamos somar os sons diferentes, acho que vai ser uma boa. gere sim", then, after comparing, "Pode deixar assim, pode abrir a PR". Kick's `Close` is nearly its `Blend` (correlation 0.97 to 0.99), so only its highs add anything.
- **Trade-off**: Kick and Snare no longer keep their recorded levels, and hits leave less headroom: the output only clamps.
- **Scope**: house-kit, Kick and Snare samples. Narrows Q5, which chose `Blend` alone
- **Date**: 2026-11-01
- **Status**: active (AD-015)

### AD-016
- **Decision**: One answer from the user closes HK-24 for all 6 pieces, in place of one answer per piece.
- **Reason**: A PR review flagged the single answer, and the user, told so, answered: "os sons estao otimos, aprovado."
- **Trade-off**: `verification.md` holds no separate judgement of each piece.
- **Scope**: house-kit, HK-24
- **Date**: 2026-11-01
- **Status**: active (AD-016)

### AD-017
- **Decision**: Sustained instruments run in their own Rust module, mixed into `fill_buffers` after the drums, playing or stopped. The Pad owns its voices, fades and effects, and uses fixed arrays.
- **Reason**: The user asked for the pad "no nosso motor". Rules on the audio thread stay in reach of `cargo test`, and a shared output keeps one clamp.
- **Trade-off**: The WASM binary grows, and every sound change needs `npm run build:wasm`.
- **Scope**: chord-pads, engine
- **Date**: 2026-11-01
- **Status**: active (AD-017)

### AD-018
- **Decision**: Notes are named by chord degree, and a double accidental becomes its natural note. `Ebm` reads `Eb Gb Bb`, and `Ebdim` reads `Eb Gb A`.
- **Reason**: Stated as a default with the spec, and the user answered "Aprovado". Musicians read degrees, and `Bbb` helps nobody improvising.
- **Trade-off**: A few spellings differ from strict theory.
- **Scope**: chord names on every screen
- **Date**: 2026-11-01
- **Status**: active (AD-018)

### AD-019
- **Decision**: `public/pads/` may take up to 12 MB, and Choir is the first sound of `Improv`. This supersedes PAD-22's 10 MB and New Age as the only bank.
- **Reason**: Q22: "subimos o limite de `public/pads/` para 12 MB, mantendo os cinco timbres?" Q23: "o Choir, seu favorito, passa a ser o som padrão...?" The user answered "q22 recomendacao q23 recomendacao".
- **Trade-off**: More files in the repository, though each downloads only when chosen.
- **Scope**: pad-timbres, supersedes PAD-22 and the first load of PAD-46
- **Date**: 2026-11-02
- **Status**: active (AD-019)

### AD-020
- **Decision**: A pad slot holds a chord and a timbre, so the same chord in another timbre is another chord to the engine. Notes a timbre adds, such as a bass, are data in `src/chords.ts`.
- **Reason**: Every fade and limit of AD-017 then applies to a change of timbre with no new code.
- **Trade-off**: A timbre change uses a second slot during its crossfade.
- **Scope**: pad-timbres, engine
- **Date**: 2026-11-02
- **Status**: active (AD-020)

### AD-021
- **Decision**: The pad's output takes a fixed gain of 2.0, 6 dB, on every timbre, and the default volume may peak at -6 dBFS. The slider stays at 70 by default. This supersedes PAD-27's and TIM-20's -12 dBFS.
- **Reason**: After hearing the leveled timbres, the user answered: "Sim, so o volume que to achando baixo comparado ao da bateria, se poderiamos aumentar mais eles todos". The pad held at about -31 dBFS RMS against drums that reach full scale, and the slider has only 3 dB above 70.
- **Trade-off**: The output only clamps (AD-015), so a pad under a full-scale drum hit reaches the clamp more often.
- **Scope**: pad-timbres, supersedes PAD-27 of chord-pads and the bound of TIM-20
- **Date**: 2026-11-02
- **Status**: active (AD-021)
