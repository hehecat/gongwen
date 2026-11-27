import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

function BaseIcon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function SealMarkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="14" height="14" rx="3.2" />
      <path d="M7 7.5h6M10 6v8M7 12.5h6" />
    </BaseIcon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5.5 7.75L10 12.25l4.5-4.5" />
    </BaseIcon>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12.25 5.5L7.75 10l4.5 4.5" />
    </BaseIcon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7.75 5.5L12.25 10l-4.5 4.5" />
    </BaseIcon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 4.5v11M4.5 10h11" />
    </BaseIcon>
  )
}

export function MinusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 10h10" />
    </BaseIcon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </BaseIcon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </BaseIcon>
  )
}

export function UploadIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 13V4.5M6.5 8L10 4.5 13.5 8" />
      <path d="M4 13.5v1.3A1.7 1.7 0 005.7 16.5h8.6a1.7 1.7 0 001.7-1.7v-1.3" />
    </BaseIcon>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 4v8.5M6.5 9.25L10 12.75l3.5-3.5" />
      <path d="M4 13.5v1.3A1.7 1.7 0 005.7 16.5h8.6a1.7 1.7 0 001.7-1.7v-1.3" />
    </BaseIcon>
  )
}

export function PrinterIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6.5 6.5V3.75h7V6.5" />
      <rect x="3.5" y="6.5" width="13" height="6.5" rx="1.6" />
      <path d="M6.5 11.5h7v4.75h-7z" fill="var(--cb-bg-elevated)" />
      <circle cx="13.75" cy="9" r="0.65" fill="currentColor" stroke="none" />
    </BaseIcon>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="7" y="7" width="9" height="9.5" rx="1.6" />
      <path d="M4.5 12.5V5.2A1.7 1.7 0 016.2 3.5h6.3" />
    </BaseIcon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 6h11M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6" />
      <path d="M6.25 6l.55 9.2a1.4 1.4 0 001.4 1.3h3.6a1.4 1.4 0 001.4-1.3L13.75 6" />
    </BaseIcon>
  )
}

export function SparkCleanIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 3.5l1.3 3.4 3.4 1.3-3.4 1.3L10 12.9 8.7 9.5 5.3 8.2l3.4-1.3L10 3.5z" />
      <path d="M14.8 12.8l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z" />
    </BaseIcon>
  )
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 3.25l5.75 2.1v4.4c0 3.65-2.45 6.15-5.75 7.25-3.3-1.1-5.75-3.6-5.75-7.25v-4.4L10 3.25z" />
      <path d="M7.5 10.1l1.75 1.75 3.45-3.6" />
    </BaseIcon>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="10" cy="10" r="6.75" />
      <path d="M10 6.75v3.75" />
      <circle cx="10" cy="13.25" r="0.75" fill="currentColor" stroke="none" />
    </BaseIcon>
  )
}

export function BookSpecIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 4.75A1.75 1.75 0 016.25 3h8.25v13.25H6.25A1.75 1.75 0 004.5 18V4.75z" />
      <path d="M4.5 15.25A1.75 1.75 0 016.25 13.5h8.25" />
      <path d="M7.75 6.75h4.25M7.75 9.5h3" />
    </BaseIcon>
  )
}

export function SearchCommandIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="9" cy="9" r="5" />
      <path d="M12.75 12.75L16 16" />
    </BaseIcon>
  )
}

export function SidebarRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M12.25 4v12" />
    </BaseIcon>
  )
}

export function FileDocIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 3.25h5.5L15 6.75v9A1.5 1.5 0 0113.5 17.25h-7A1.5 1.5 0 015 15.75v-11A1.5 1.5 0 016.5 3.25z" />
      <path d="M11.25 3.5V7H14.75" />
      <path d="M7.75 10.25h4.5M7.75 13h3.25" />
    </BaseIcon>
  )
}

export function SwatchTemplateIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3.5" y="4" width="13" height="12" rx="2" />
      <path d="M3.5 8h13M8 8v8" />
    </BaseIcon>
  )
}

export function PinIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <BaseIcon {...props}>
      <path
        d="M10 2.75l2.05 4.15 4.58.67-3.31 3.23.78 4.56L10 13.2l-4.1 2.16.78-4.56-3.31-3.23 4.58-.67L10 2.75z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </BaseIcon>
  )
}

export function RotateResetIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 9.5a5.5 5.5 0 111.45 4.2" />
      <path d="M4.25 5.75v3.9h3.9" />
    </BaseIcon>
  )
}

export function WandFixIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 15.5L13 7M11.25 5.25l3.5 3.5" />
      <path d="M14.5 3.5v2M13.5 4.5h2M6.5 4.5v1.5M5.75 5.25h1.5" />
    </BaseIcon>
  )
}

export function ImageSealIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="1.8" />
      <circle cx="7.5" cy="8.25" r="1.25" />
      <path d="M4.25 14l3.75-3.5 2.75 2.5 2.25-2 3.25 3" />
    </BaseIcon>
  )
}

export function JumpLineIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 10h9.5M11 6.5L14.5 10 11 13.5" />
    </BaseIcon>
  )
}
