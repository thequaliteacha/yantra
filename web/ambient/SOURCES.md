# Ambient rain

The timed sit's noise and harmonic beds are synthesized in the browser. The four rain beds are public-domain recordings, encoded to mono MP3 and stored in the R2 bucket under `ambient/`. They are not copied from Insight Timer or Waking Up.

`deploy/cloudflare/upload-ambient.sh` downloads the files below, encodes them, and uploads any key that is not already in the bucket. The staged audio stays in `web/ambient-stage/`, which is gitignored.

| Id | R2 key | Title | Author | License | Source |
| --- | --- | --- | --- | --- | --- |
| rain-light | ambient/rain-light.mp3 | Rain | ジダネ | Public domain | https://commons.wikimedia.org/wiki/File:Rain.ogg |
| rain-steady | ambient/rain-steady.mp3 | Raining cats and dogs | ezwa | Public domain | https://commons.wikimedia.org/wiki/File:Rain_(1).ogg |
| rain-roof | ambient/rain-roof.mp3 | Rain on a veranda and thunder | ezwa | Public domain | https://commons.wikimedia.org/wiki/File:Rain_on_a_veranda_and_t.ogg |
| rain-thunder | ambient/rain-thunder.mp3 | Rain and thunder | Caesar | Public domain | https://commons.wikimedia.org/wiki/File:Rain_and_thunder.ogg |

Direct downloads:

- Light rain: https://upload.wikimedia.org/wikipedia/commons/3/3d/Rain.ogg
- Steady rain: https://upload.wikimedia.org/wikipedia/commons/0/0e/Rain_%281%29.ogg
- Rain on a roof: https://upload.wikimedia.org/wikipedia/commons/7/7c/Rain_on_a_veranda_and_t.ogg
- Distant thunder: https://upload.wikimedia.org/wikipedia/commons/4/42/Rain_and_thunder.ogg

The two ezwa recordings were published as PDSounds records 682 ("Raining cats and dogs") and 684 ("Rain on a veranda and thunder") and dedicated to the public domain. The veranda recording is the "Rain on a roof" bed. Caesar's recording was made in Sundbyberg, Stockholm.

Each file is crossfaded at the loop point in the browser, then faded in at the start of the sit and out at the end. White, pink, and brown noise, and the drone, singing-bowl, and pad beds, are generated with Web Audio and are not in this list.
