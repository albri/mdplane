const PLANE_PATH =
  'M231.4,44.34s0,.1,0,.15l-58.2,191.94a15.88,15.88,0,0,1-14,11.51q-.69.06-1.38.06a15.86,15.86,0,0,1-14.42-9.15L107,164.15a4,4,0,0,1,.77-4.58l57.92-57.92a8,8,0,0,0-11.31-11.31L96.43,148.26a4,4,0,0,1-4.58.77L17.08,112.64a16,16,0,0,1,2.49-29.8l191.94-58.2.15,0A16,16,0,0,1,231.4,44.34Z'

type LogoProps = {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ''}`.trim()}>
      <span className="relative inline-block size-6.5 shrink-0 overflow-visible" aria-hidden>
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(85% 85% at 30% 30%, #c6f66c 0%, #84cc16 46%, #3f6a0a 100%)',
          }}
        />
        <svg
          viewBox="0 0 256 256"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -right-[6%] -top-[3%] h-[90%] w-[90%] rotate-[15deg] text-white"
          fill="currentColor"
        >
          <path d={PLANE_PATH} />
        </svg>
      </span>
      <span className="font-mono text-[1.05rem] font-semibold tracking-tight">
        <span className="text-fd-primary">md</span>
        <span>plane</span>
      </span>
    </span>
  )
}
