# Drum kit samples

Each file in this folder is one hit, trimmed and faded, at 44.1 kHz, 16-bit, stereo. The files here are peak-normalized to -1 dBFS; the files in `house/` are not (see The House Kit below).

## Earlier samples

`/hihat.wav` sits in `public/`, and is not processed like the files above.

| File | Source | License |
| ---- | ------ | ------- |
| `hihat.wav` | `hihat-close.wav` from https://github.com/ArunMichaelDsouza/javascript-30-course | That repository is MIT; the sample's own origin is not stated |

SM Drums was the first choice. Its package, checked on 2026-11-01, holds no license terms and its author's site states none, so it is not shipped.

## The Open Source Drum Kit

By Real Music Media. Its author placed the samples in the public domain: "The samples and the mappings are completely in the public domain."

- Statement: https://www.kvraudio.com/forum/viewtopic.php?t=277132
- Mirror used: https://github.com/crabacus/the-open-source-drumkit

| File | Source |
| ---- | ------ |
| `open-hat.wav` | `hihat/half-open-hihat/hohh38.wav` |
| `ride.wav` | `ride/ride-mid-out11.wav` |
| `ride-bell.wav` | `ride/ride-bell12.wav` |
| `crash.wav` | `crash/crash25.wav` |

## China

`china.wav` is "Savannah China.wav" by xIceCoffeex, released under CC0 1.0, taken from Freesound's high-quality preview.

- Source: https://freesound.org/people/xIceCoffeex/sounds/171481/
- License: https://creativecommons.org/publicdomain/zero/1.0/

## The House Kit

By Better Mixes. Thank you, Better Mixes, for the kick, snare and toms.

- Channel: https://www.youtube.com/@BetterMixes
- Product page: https://www.bettermixes.com/drumsamples

No written terms were found in the zip or on the product pages. The release for general use is the user's account of the video https://www.youtube.com/watch?v=WFS0_5Qsc1w, not a written license.

Every piece starts from the `Blend` mic. The toms were converted with no gain: the files keep their recorded levels, and only the tail was cut at -60 dBFS and faded. Kick adds the same take from `Kick/Close`, above 2 kHz, and from `Kick/Room` at half level. Snare adds the same take from `Snare/Close`, lined up, and from `Snare/Room` at half level. Each of those two pieces then gets one gain for all its takes. `<take>` is 1, 2 or 3 in both columns.

| Piece | Folder |
| ----- | ------ |
| Kick | `house/kick/` |
| Snare | `house/snare/` |
| High Tom | `house/tom-10/` |
| Mid Tom | `house/tom-12/` |
| Low Tom | `house/tom-14/` |
| Floor Tom | `house/tom-16/` |

Each sample's source, by piece, recording and take, in the kit's own folders:

| File | Source |
| ---- | ------ |
| `house/kick/soft-<take>.wav` | `Kick/Blend/Soft <take>.wav` |
| `house/kick/med-<take>.wav` | `Kick/Blend/Med <take>.wav` |
| `house/kick/hard-<take>.wav` | `Kick/Blend/Hard <take>.wav` |
| `house/snare/soft-<take>.wav` | `Snare/Blend/Soft <take>.wav` |
| `house/snare/hard-<take>.wav` | `Snare/Blend/Hard <take>.wav` |
| `house/snare/crack-<take>.wav` | `Snare/Blend/Crack <take>.wav` |
| `house/tom-10/soft-<take>.wav` | `Toms/10/Blend/Soft <take>.wav` |
| `house/tom-10/med-<take>.wav` | `Toms/10/Blend/Med <take>.wav` |
| `house/tom-10/hard-<take>.wav` | `Toms/10/Blend/Hard <take>.wav` |
| `house/tom-12/soft-<take>.wav` | `Toms/12/Blend/Soft <take>.wav` |
| `house/tom-12/med-<take>.wav` | `Toms/12/Blend/Med <take>.wav` |
| `house/tom-12/hard-<take>.wav` | `Toms/12/Blend/Hard <take>.wav` |
| `house/tom-14/soft-<take>.wav` | `Toms/14/Blend/Soft <take>.wav` |
| `house/tom-14/med-<take>.wav` | `Toms/14/Blend/Med <take>.wav` |
| `house/tom-14/hard-<take>.wav` | `Toms/14/Blend/Hard <take>.wav` |
| `house/tom-16/soft-<take>.wav` | `Toms/16/Blend/Soft <take>.wav` |
| `house/tom-16/med-<take>.wav` | `Toms/16/Blend/Med <take>.wav` |
| `house/tom-16/hard-<take>.wav` | `Toms/16/Blend/Hard <take>.wav` |

## New Age pad

`public/pads/new-age/` holds 9 notes of New Age by Roberto of the FreePats project, made with the ZynAddSubFX and Yoshimi synthesizers. Its README states: "Published under the terms of Creative Commons CC0 public domain dedication." The files are unchanged, except that `G#` became `Gs` in their names, because `#` breaks URLs.

- Source: https://github.com/freepats/new-age
- License: https://creativecommons.org/publicdomain/zero/1.0/

| File | Source |
| ---- | ------ |
| `pads/new-age/Gs2.flac` | `samples/G#2.flac` |
| `pads/new-age/C3.flac` | `samples/C3.flac` |
| `pads/new-age/E3.flac` | `samples/E3.flac` |
| `pads/new-age/Gs3.flac` | `samples/G#3.flac` |
| `pads/new-age/C4.flac` | `samples/C4.flac` |
| `pads/new-age/E4.flac` | `samples/E4.flac` |
| `pads/new-age/Gs4.flac` | `samples/G#4.flac` |
| `pads/new-age/C5.flac` | `samples/C5.flac` |
| `pads/new-age/E5.flac` | `samples/E5.flac` |

## Synth Pad Choir

`public/pads/choir/` holds 5 notes of Synth Pad Choir, samples by 快乐爱的小精灵 (Elf of Happy and Love), made with ZynAddSubFX and edited by Roberto for the FreePats project. Its README states: "Published under the terms of Creative Commons CC0 public domain dedication." The files are unchanged, except that `F#` became `Fs` in their names, because `#` breaks URLs.

- Source: https://github.com/freepats/synth-pad-choir
- License: https://creativecommons.org/publicdomain/zero/1.0/

| File | Source |
| ---- | ------ |
| `pads/choir/C3.flac` | `samples/C3.flac` |
| `pads/choir/Fs3.flac` | `samples/F#3.flac` |
| `pads/choir/C4.flac` | `samples/C4.flac` |
| `pads/choir/Fs4.flac` | `samples/F#4.flac` |
| `pads/choir/C5.flac` | `samples/C5.flac` |

## Sweep Pad

`public/pads/sweep/` holds 9 notes of Sweep Pad by Roberto of the FreePats project, made with the ZynAddSubFX and Yoshimi synthesizers. Its README states: "Published under the terms of Creative Commons CC0 public domain dedication." The files are unchanged, except that `G#` became `Gs` in their names, because `#` breaks URLs.

- Source: https://github.com/freepats/sweep-pad
- License: https://creativecommons.org/publicdomain/zero/1.0/

| File | Source |
| ---- | ------ |
| `pads/sweep/Gs2.flac` | `samples/G#2.flac` |
| `pads/sweep/C3.flac` | `samples/C3.flac` |
| `pads/sweep/E3.flac` | `samples/E3.flac` |
| `pads/sweep/Gs3.flac` | `samples/G#3.flac` |
| `pads/sweep/C4.flac` | `samples/C4.flac` |
| `pads/sweep/E4.flac` | `samples/E4.flac` |
| `pads/sweep/Gs4.flac` | `samples/G#4.flac` |
| `pads/sweep/C5.flac` | `samples/C5.flac` |
| `pads/sweep/E5.flac` | `samples/E5.flac` |

## Orchestra pad

`public/pads/orchestra/` holds 14 notes built by `scripts/build_orchestra_bank.py` from the string recordings of VSCO 2 Community Edition by Versilian Studios, whose LICENSE is the CC0 1.0 Universal dedication. These files are processed: each recording is pitched to its key, tuned, looped and levelled, and the recordings of a key are mixed. The table names the recordings of each file, by their paths in the repository, and VSCO counts octaves so that C3 is MIDI 60.

- Source: https://github.com/sgossner/VSCO-2-CE
- License: https://creativecommons.org/publicdomain/zero/1.0/

| File | Source |
| ---- | ------ |
| `pads/orchestra/B0.flac` | `Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_F#0_v1_rr1.wav` |
| `pads/orchestra/Ds1.flac` | `Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_F#0_v1_rr1.wav` |
| `pads/orchestra/G1.flac` | `Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_G0_v1_rr1.wav` |
| `pads/orchestra/B1.flac` | `Strings/Cello Section/susvib/susvib_C1_v1_1.wav`, `Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_C1_v1_rr1.wav` |
| `pads/orchestra/Ds2.flac` | `Strings/Cello Section/susvib/susvib_E1_v1_1.wav`, `Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_E1_v1_rr1.wav` |
| `pads/orchestra/G2.flac` | `Strings/Cello Section/susvib/susvib_G1_v1_1.wav`, `Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_G#1_v1_rr1.wav` |
| `pads/orchestra/B2.flac` | `Strings/Cello Section/susvib/susvib_B1_v1_1.wav` |
| `pads/orchestra/Ds3.flac` | `Strings/Viola Section/susvib/ViolaEns_susvib_E2_v1_1.wav` |
| `pads/orchestra/G3.flac` | `Strings/Viola Section/susvib/ViolaEns_susvib_B2_v1_1.wav` |
| `pads/orchestra/B3.flac` | `Strings/Violin Section/susVib/VlnEns_susVib_B2_v1.wav` |
| `pads/orchestra/Ds4.flac` | `Strings/Violin Section/susVib/VlnEns_susVib_D3_v1.wav` |
| `pads/orchestra/G4.flac` | `Strings/Violin Section/susVib/VlnEns_susVib_F#3_v1.wav` |
| `pads/orchestra/B4.flac` | `Strings/Violin Section/susVib/VlnEns_susVib_C4_v1.wav` |
| `pads/orchestra/Ds5.flac` | `Strings/Violin Section/susVib/VlnEns_susVib_E4_v1.wav` |
