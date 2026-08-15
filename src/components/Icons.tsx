import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const defaults: IconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
  'aria-hidden': true,
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 5.5h18M3 12h18M3 18.5h18" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M20 15.1A8 8 0 0 1 8.9 4a8.2 8.2 0 1 0 11.1 11.1Z" />
    </svg>
  )
}

export function ArrowIcon({ direction = 'right', ...props }: IconProps & { direction?: 'left' | 'right' | 'down' }) {
  const transform = direction === 'left' ? 'rotate(180 12 12)' : direction === 'down' ? 'rotate(90 12 12)' : undefined
  return (
    <svg {...defaults} {...props}>
      <g transform={transform}>
        <path d="M3 12h17M14 6l6 6-6 6" />
      </g>
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M4 4l16 16M20 4 4 20" />
    </svg>
  )
}

export function SpeakerIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 5v14M16 5v14" />
    </svg>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  )
}

export function ResetViewIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M5.2 8.2A8 8 0 1 1 4 14" />
      <path d="M5.2 3.8v4.4H9.6" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ZoomInIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M10.5 7.5v6M7.5 10.5h6m2.8 4.8 4.2 4.2" />
    </svg>
  )
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M7.5 10.5h6m2.8 4.8 4.2 4.2" />
    </svg>
  )
}
