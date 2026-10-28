import { Composition, Sequence, Still } from 'remotion'
import { AT, DURATION, Film, type FilmProps } from './Film.tsx'
import { filmSession } from './session.ts'
import { c, font, FPS, H, W, X } from './theme.ts'

const defaultProps: FilmProps = { session: { entries: [], brief: '', rehashed: {} } }
const calculateMetadata = async () => ({ props: { session: await filmSession() } })

const LENGTH = `${Math.floor(DURATION / 60)}:${String(Math.floor(DURATION % 60)).padStart(2, '0')}`

// The README's poster: one frame of the film, with a play button where the route will dock.
function Poster(props: FilmProps) {
  return (
    <>
      <Sequence from={-Math.round((AT.route + 4) * FPS)}>
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

export function Root() {
  return (
    <>
      <Composition
        id="mdplane"
        component={Film}
        durationInFrames={DURATION * FPS}
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
    </>
  )
}
