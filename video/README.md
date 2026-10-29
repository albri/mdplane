# The mdplane film

A 2:16 film for the top of the README: what mdplane is, how it works and why it exists. It is made
with [Remotion](https://www.remotion.dev) from the landing page's tokens and fonts, and it replays
the landing page's sample session. The keys in it are made up and masked.

## Render it with one command

Run these from the repository root.

| Command                               | What it does                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm --filter @mdplane/video render` | Renders `mdplane.mp4` and `poster.webp` into this folder, in about four minutes.                 |
| `pnpm --filter @mdplane/video studio` | Opens Remotion Studio, to scrub through the film while you change it.                            |
| `pnpm --filter @mdplane/video stills` | Renders key frames to `out/stills/`. Add seconds, like `stills 25 46.5`, to render other frames. |

## Start with the storyboard

`storyboard.md` has the brief, the style, the motion rules and the shot list. The times of the shots
are at the top of `src/Film.tsx`, and each scene in `src/scenes/` has its beats at the top of its
file. `src/route.tsx` holds the route and the logo, which stay on screen across shots.

`src/session.ts` takes the sample session from `apps/site/src/sample.ts` and reseals it on a fixed
day, so every render shows the same hashes. Task states come from the contract's `deriveTasks` and
fingerprints from its `hashEntry`.

## Remotion is pinned to 4.0.533

Later versions download Chrome 157, whose headless shell hung on macOS 26 before it drew the first
frame. 4.0.533 uses Chrome 149. Keep every Remotion package on the same exact version.

Remotion Studio serves font files by their path, which doesn't resolve into a pnpm workspace's
shared `node_modules`. `webpack.ts` inlines the two fonts instead, so they load the same way in the
studio and in renders.

## Upload it again after a render

GitHub plays a video in a README only when it was uploaded to GitHub, so the README embeds the film
by its `https://github.com/user-attachments/assets/…` URL. After a render, edit `README.md` on
github.com, drag `mdplane.mp4` into the editor, and replace the old URL with the new one, on its own
line. The player shows the film's first frame until you press play, which is why the film opens on
the drawn logo. `poster.webp` is a still from the route, for anywhere that can't play video.
