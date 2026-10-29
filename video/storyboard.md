# The mdplane film

**One sentence.** mdplane is a shared worklog any agent can join with one URL:
your agent sets the job and hands out links, the other agents claim and report,
and you watch the work and check its history.

**Audience.** People who open the repository and know coding agents. They
should get what it is, how it works and why it exists in a little over two
minutes, with the sound off.

**Format.** 1920×1080 at 60fps, no audio, embedded at the top of the README.

## Style

The landing page is the reference, and the film uses its tokens.

- White page, cool neutrals, rust `#9c3b17` for the route and actions. Green
  and red only for a hash that matches or doesn't.
- Schibsted Grotesk 650 for statements, Fragment Mono for paths, times, hashes
  and log metadata.
- Lines first: 1px rules, 3px route lines, no shadows, no gradients.
- Captions are full statements, one at a time, top left. No eyebrows, no
  numbers above them, no fact cards.
- The four steps are numbered once, in the route. The route then docks in the
  footer and shows where the film is.
- Keys are made up and masked: `wk_7Qm2x9Lp4Rt8.••••`.

## Motion

Every movement says something: a line drawing in is something that has
happened, a stop filling is a step reached, an entry rising is an entry
appended. There is one ease for arrivals, the site's `cubic-bezier(0.2, 0.7,
0.1, 1)`, and one for moving things between places. Nothing bounces, and the
camera never moves.

- Statements rise word by word out of a mask, hold for their reading time, and
  leave upwards.
- Every statement and every new line of text holds for at least 1s plus 0.25s
  a word once it has arrived. Dense frames, like the task routes, the link
  tiers and the reader, hold longer.
- One thing moves at a time. Nothing else moves while a statement arrives, and
  the footer route moves on while the shot before leaves.
- The route and the logo are each one object for the whole film. They change
  size and place, but never cut.

## Data

The film replays the landing page's sample session, `apps/site/src/sample.ts`,
resealed on a fixed day so that every render shows the same hashes. Task states
come from the contract's `deriveTasks` and fingerprints from its `hashEntry`.

The Watch shot draws the landing page's compact reader as the site builds it at
1440 wide: the masked link alone in its bar, one row per task, and the quiet
status in the footer. Its state comes from the site's `model.ts`, and both
panes scroll by the reader's own rule.

## Shots

| Time         | Shot   | The viewer learns                                                                                   |
| ------------ | ------ | --------------------------------------------------------------------------------------------------- |
| 0–8.6s       | Open   | The logo, then "A shared worklog any agent can join with one URL."                                  |
| 8.6–19.5s    | Why    | Four agents on four machines have no shared place; their lines join into one file                   |
| 19.5–27.7s   | Route  | How it works in four stops; the route docks in the footer                                           |
| 27.7–44.8s   | Job    | The brief is typed at the top of `queue.md`; tasks and claims append below                          |
| 44.8–65.6s   | Link   | Read, append and write links reach different stops; your agent gives one append link to four agents |
| 65.6–98.2s   | Claims | Task #2: a second claim is refused. Task #5: a quiet agent's lease runs out                         |
| 98.2–129.2s  | Watch  | The reader fills live, then is scrubbed back to #12; editing #15 breaks every later fingerprint     |
| 129.2–136.4s | Close  | The logo, the line and `mdplane.dev`                                                                |

The exact times live at the top of `src/Film.tsx`, and each shot's beats at the
top of its scene file.
