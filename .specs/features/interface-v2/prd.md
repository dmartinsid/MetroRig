# Product Requirements Document (PRD): MetroRig Interface Modernization

**Produto:** MetroRig — Metrônomo Profissional & Speed Trainer para Guitarristas  
**Versão:** 2.0 (Interface DAW Rack Unit & Stadium Practice)  
**Status:** Pronto para Desenvolvimento / Engenharia  
**Público-Alvo:** Guitarristas, bateristas, instrumentistas em geral e engenheiros de áudio que buscam precisão de tempo com zero-drift e rotinas de treino de velocidade.

---

## 1. Visão Geral e Objetivos do Produto

O MetroRig é concebido não como um website comum, mas como um **instrumento digital e plugin padrão DAW**, trazendo fidelidade mecânica de tempo real, feedback visual de alta legibilidade à distância e modularidade de groove sequencing.

### Objetivos Principais:
1. **Unificação Visual e Sensação de Hardware:** Implementar o design system *Studio Rack Precision* com estética dark glassmorphic, tons de chassi escuro (`#080810`), acentos de sinal em verde neon fosforescente (`#39FF14`) e quatro cores canônicas para trilhas de áudio.
2. **Editor Mode (Modo Linear):** Fornecer um sequenciador de 16 a 32 subdivisões com controle tátil de figuras rítmicas, time signatures e barramento de tempo.
3. **Practice Stadium Mode (Modo Polar):** Oferecer um relógio rítmico concêntrico circular e mostrador de tempo gigante (128px) visível a vários metros de distância (palco ou sala de ensaio).
4. **Precisão de Tempo (Zero-Drift Web Audio / DSP):** Garantir que a renderização visual e animações de varredura sejam sincronizadas com o clock de áudio (`AudioContext` / DSP buffer), sem jitter ou travamentos.

---

## 2. Telas & Arquitetura de Navegação

A aplicação opera em dois modos intercambiáveis que compartilham o mesmo estado de motor rítmico (Web Audio Engine):

| Modo | Finalidade Principal | Elemento Hero |
| :--- | :--- | :--- |
| **Editor Mode** (`SCREEN_4`) | Criação, edição de grooves, configuração de compassos e rotinas do Speed Trainer. | Sequenciador linear de 16 passos com paleta de figuras. |
| **Practice Stadium Mode** (`SCREEN_2`) | Execução e prática em tempo real, monitoramento de tempo acumulado e rotina de velocidade. | Relógio concêntrico de 4 anéis (*Beat Clock*) & Display BPM de 128px. |

---

## 3. Especificação do Header & Shell Global (TopNavBar)

Presente em ambos os modos como barra fixa superior (`sticky top-0 z-50`):
- **Branding:** Logotipo `METRORIG` em JetBrains Mono Bold com glow verde fosforescente (`drop-shadow: 0 0 12px rgba(57,255,20,0.4)`), acompanhado de badge outlined `PRO`.
- **Navegação Rápida:** Links `Editor`, `Stadium`, `Grooves`, `Presets`.
- **Seletores no Header:**
  - *Sound Engine:* Dropdown recessed (`Click: Digital`, `Mechanical`, `Woodblock`, `Stick Click`, `Cowbell`).
  - *Meter:* Dropdown recessed (`4/4 Metronome`, `3/4 Metronome`, `6/8 Metronome`, `7/8 Metronome`).
- **Ações Rápidas à Direita:**
  - Botão de toggle rápido em pílula outlined (`GO TO STADIUM MODE` no Editor / `GO TO EDITOR MODE` no Stadium).
  - Ícones de atalho para configurações e calibração de áudio (`settings`, `tune`).
- **Barra de Rodapé DSP (Hardware Status):**
  - Indicador de Audio Clock (ex: `48.0 kHz · 64 SPLS (1.3ms)`), `Latency: Zero-Drift Hardware Parity`, `DSP Engine: MetroRig Core V2.4.8` e monitor de CPU.

---

## 4. Requisitos Detalhados — Editor Mode (`SCREEN_4`)

### 4.1. Sequenciador de Passos (Left Column — 2fr)
1. **Cabeçalho de Telemetria:**
   - Display mono: `4/4 Metronome · 4/4 · 120 BPM`.
   - Status de sincronismo: `SYNC: INTERNAL AUDIO CORE` com timer de sessão ativo em mono verde (`00:04:12`).
2. **Barra de Figuras Rítmicas (Figure Palette):**
   - Chips com atalhos rápidos de inserção: `Step`, `Quarter ●···` (ativo com borda neon), `Eighths ●·●·`, `Gallop ●·●●`, `Rev. Gallop ●●·●`, `16ths ●●●●`, `Rest ····`.
   - Ao selecionar uma figura e clicar em uma célula, preenche o compasso/tempo correspondente.
3. **Contagem de Subdivisões (Count Row):**
   - Rótulos em JetBrains Mono: `1 e & a  2 e & a  3 e & a  4 e & a`.
   - Cabeças de tempo (`1`, `2`, `3`, `4`) destacadas com opacidade 100% e fundo ligeiramente elevado.
4. **Matriz de Pistas (Track Grid):**
   - **Cores Estritas por Pista:**
     - `CLICK` (0): Âmbar `#FFB800`
     - `KICK` (1): Coral `#FF2D55`
     - `SNARE` (2): Ciano Gelo `#00D4FF`
     - `HI-HAT` (3): Menta `#00FF94`
   - **Estados das Células:**
     - `0 (Vazio)`: Fundo escuro sutil com borda hairline.
     - `1 (Hit)`: Fundo 25% da cor da pista, borda sólida com leve glow de 8px.
     - `2 (Accent - exclusivo do Click)`: Preenchimento sólido na cor da pista, glow expansivo de 16px.
   - **Controles por Pista:** Botões de `M` (Mute) e `S` (Solo) para cada instrumento.
5. **Barra de Informações de Padrão:**
   - Exibe `PAT: ROCK_GROOVE_STD`, `STEPS: 16/16`, `RESOLUTION: 1/16th`, `POS: BAR 01 · STEP 01`.

### 4.2. Coluna de Controle de Estúdio (Right Column — 1fr)
1. **Tempo Bus Card:**
   - Dígito gigante de 64px `120 BPM` em verde neon (`#39FF14`).
   - Slider contínuo de 40 a 240 BPM com trilha hairline e thumb circular iluminado.
   - Botão de Ação Primária Full-Width: `▶ PLAY` / `■ STOP` em pílula outline com transição rápida de preenchimento.
2. **Save Preset Inline Toast:**
   - Campo recessed com pré-preenchimento (ex: `Rock Groove (120)`).
   - Botão `Save` em fundo verde escuro (`#1E640B`) com texto neon.
3. **Measure & Groove Card:**
   - Seletores numéricos de precisão: `Numerator` (`4`) e `Denominator` (`/4`).
   - Dropdown `GROOVE LIBRARY` com presets carregados (`Rock Groove (120)`, `Metal Groove (140)`, `Blues Shuffle (135)`, `Jazz Swing (195)`, `Metalcore Breakdown (160)`).
   - Botão em ciano translúcido `Save Groove`.
4. **Tempo Trainer Card (Speed Trainer Colapsável):**
   - Switch de ativação com dot indicador de 7px pulsante.
   - Campos configuráveis:
     - `Start BPM` (ex: 120) e `Target BPM` (ex: 160).
     - `Increment` (ex: +5 BPM) e `Step Value` (ex: 4).
     - `Step Type` (`Measures` ou `Seconds`).
     - `Curve` (`Stepped` ou `Smooth Ramp`).

---

## 5. Requisitos Detalhados — Practice Stadium Mode (`SCREEN_2`)

### 5.1. Hero: Beat Clock Polar Concêntrico (Esquerda)
1. **Geometria:**
   - SVG responsivo (`min(70vh, 90vw)` e até 560px de largura).
   - 4 anéis concêntricos concêntricos de fora para dentro:
     - 1º Anel (Externo): `CLICK` (Âmbar `#FFB800`)
     - 2º Anel: `KICK` (Coral `#FF2D55`)
     - 3º Anel: `SNARE` (Ciano `#00D4FF`)
     - 4º Anel (Interno): `HI-HAT` (Menta `#00FF94`)
2. **Divisão de Fatias (Slices):**
   - 16 fatias radiais (para compasso 4/4). Fatias ativas preenchidas na cor da respectiva pista; fatias inativas em preto azulado neutro (`#16161F`).
3. **Marcadores Numéricos:**
   - Dígitos `1`, `2`, `3`, `4` posicionados externamente aos anéis, acendendo em verde neon vibrante no tempo forte ativo.
4. **Ponteiro de Varredura (Sweep Hand):**
   - Agulha linear branca com 70% de opacidade conectada ao cubo central, girando em sincronicidade contínua com o clock de áudio.

### 5.2. Painel de Prática e Speed Trainer (Direita)
1. **Rotina do Speed Trainer:**
   - Dropdown compacto com rotinas reais para treino de palhetada alternada e velocidade:
     `Calvagada - 148 - 190`, `69 - 110 - 4/4`, `110-135 - 4/4`, `Ligados`, etc.
2. **Cronômetro de Rehearsal:**
   - Display digital monospaced com tracking amplo: `00:04:12`.
3. **Display de BPM Colossal (128px):**
   - Renderização monospaced JetBrains Mono 900 `120.0 BPM` com glow verde neon de 30px, visível em estúdio/palco sem esforço ocular.
4. **Linha de Status do Trainer:**
   - Pill em amarelo cyber (`#FFE600`): `Trainer 120 → 160 BPM · +5 every 4 bars` com ponto indicador pulsante.
5. **Orbs de Instrumentos Táteis:**
   - 4 círculos táteis de 48px fixos nas cores canônicas: Click, Kick, Snare, Hi-hat.
   - Animação de micro-escala (`1.15 -> 1.0` via CSS/JS) no momento exato do impacto rítmico, sem alterar a cor base nem causar flash incômodo de luminosidade.
6. **Controle de Play:**
   - Botão centralizado em pílula verde neon `▶ PLAY`.

---

## 6. Design System & Tokens Visuais (Studio Rack Precision)

### Cores Principais
- **Fundo / Chassi:** `#080810` (Studio Black)
- **Painéis Smoked Glass:** `rgba(255, 255, 255, 0.04)` com `backdrop-filter: blur(20px)`
- **Bordas Hairline Glass:** `rgba(255, 255, 255, 0.08)`
- **Campos Recessivos (Inputs/Selects):** `rgba(8, 8, 16, 0.8)` com borda fina
- **Live Signal / Neon Green:** `#39FF14`
- **Cyber Yellow (Status Trainer):** `#FFE600`

### Tipografia
- **JetBrains Mono:** Números de BPM, temporizadores, código de compasso, subdivisões e logotipo.
- **Inter:** Rótulos de campos (em caixa alta e tracking aumentado), nomes de pistas e botões operacionais.

---

## 7. Requisitos Técnicos & Arquitetura Frontend

1. **Estado Centralizado (Audio Core State):**
   - Manter um único store (ex: Zustand, Pinia ou Web Audio Engine Worker) compartilhando:
     - `bpm`: número em ponto flutuante.
     - `isPlaying`: boolean.
     - `currentStep` / `currentBar`: inteiros sincronizados.
     - `gridMatrix`: matriz 4x32 com estados `[0, 1, 2]`.
     - `trainerSettings`: limites e parâmetros de aceleração.
2. **Audio Clock & Zero-Drift:**
   - Não utilizar `setInterval` ou `setTimeout` padrão para o disparo sonoro. Implementar loop de agendamento adiantado com `AudioContext.currentTime` (Web Audio API) ou Web Audio Worklet.
3. **Animações e Framerate:**
   - Sincronização do ponteiro radial do Beat Clock e orbs usando `requestAnimationFrame` atrelado ao `AudioContext.currentTime`.
4. **Responsividade:**
   - Layout de 2 colunas para desktop (min 1024px).
   - No Stadium Mode, empilhar suavemente o Beat Clock e o painel de leitura mantendo proporção circular via SVG.

---

## 8. Plano de Entrega e Fases de Implementação

- **Fase 1 — Shell & Design System Tokens:** Configurar Tailwind tokens, cores de track e layout de header com troca de rotas.
- **Fase 2 — Editor Mode:** Desenvolver a grade do sequenciador, figure palette, seletores de compasso e bus de BPM.
- **Fase 3 — Practice Stadium Mode:** Renderizar o relógio SVG de 4 anéis concêntricos, ponteiro rotativo e display de 128px com orbs táteis.
- **Fase 4 — Motor de Áudio & Speed Trainer:** Integrar a rotina de aceleração de BPM automática a cada N compassos e testar latência de hardware.
