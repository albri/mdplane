import { Composition, Sequence, Still } from 'remotion'
import { AT, DURATION, Film, type FilmProps } from './Film.tsx'
import { filmSession } from './session.ts'
import { c, font, FPS, H, W, X } from './theme.ts'

const defaultProps: FilmProps = {
  session: { workspaceId: '', entries: [], brief: '', bodies: {}, rehashed: {} },
}
const calculateMetadata = async () => ({ props: { session: await filmSession() } })

const LENGTH = `${Math.floor(DURATION / 60)}:${String(Math.floor(DURATION % 60)).padStart(2, '0')}`

// The README's poster: one frame of the film, with a play button where the route will dock.
function Poster(props: FilmProps) {
  return (
    <>
      <Sequence from={-Math.round((AT.route + 5.5) * FPS)}>
        <Film {...props} />
      </Sequence>
      <div
        style={{
          position: 'absolute',
          right: X,
          top: 1000 - 44,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          fontFamily: font.mono,
          fontSize: 30,
          color: c.ink2,
        }}
      >
        {LENGTH}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: c.action,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              marginLeft: 7,
              borderTop: '19px solid transparent',
              borderBottom: '19px solid transparent',
              borderLeft: `30px solid ${c.page}`,
            }}
          />
        </div>
      </div>
    </>
  )
}

// The site's share card: the poster's frame without the play button, cut to the 1.91:1 that link
// previews use. It renders at 1920 wide and is scaled down to 1200 × 630.
const CARD_H = Math.round((W * 630) / 1200)

function Card(props: FilmProps) {
  return (
    <div style={{ position: 'absolute', top: (CARD_H - H) / 2, width: W, height: H }}>
      <Sequence from={-Math.round((AT.route + 5.5) * FPS)} layout="none">
        <Film {...props} />
      </Sequence>
    </div>
  )
}

export function Root() {
  return (
    <>
      <Composition
        id="mdplane"
        component={Film}
        durationInFrames={Math.round(DURATION * FPS)}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={defaultProps}
        calculateMetadata={calculateMetadata}
      />
      <Still
        id="poster"
        component={Poster}
        width={W}
        height={H}
        defaultProps={defaultProps}
        calculateMetadata={calculateMetadata}
      />
      <Still
        id="card"
        component={Card}
        width={W}
        height={CARD_H}
        defaultProps={defaultProps}
        calculateMetadata={calculateMetadata}
      />
    </>
  )
}
