import type { SVGProps } from 'react';

/**
 * Minimal stroke icon set (Lucide-style, 24×24, stroke 1.8). Decorative by default (aria-hidden).
 * `flipInRtl` mirrors directional icons (arrows/chevrons/send) in right-to-left layouts.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number; flipInRtl?: boolean };

function Svg({ size = 20, flipInRtl, className, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={[flipInRtl ? 'rtl:-scale-x-100' : '', className ?? ''].join(' ').trim() || undefined}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>;
export const MoonIcon = (p: IconProps) => <Svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Svg>;
export const SendIcon = (p: IconProps) => <Svg flipInRtl {...p}><path d="M4 12l16-8-6 16-2-7z" /></Svg>;
export const ChevronIcon = (p: IconProps) => <Svg flipInRtl {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const ClockIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const ShieldIcon = (p: IconProps) => <Svg {...p}><path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6z" /></Svg>;
export const PhoneMissedIcon = (p: IconProps) => <Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /><path d="M16 3l5 5M21 3l-5 5" /></Svg>;
export const CalendarIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const InboxIcon = (p: IconProps) => <Svg {...p}><path d="M4 13l3-8h10l3 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></Svg>;
export const UserIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>;
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" /></Svg>;
export const LoaderIcon = (p: IconProps) => <Svg {...p} className={['animate-spin motion-reduce:animate-none', p.className].filter(Boolean).join(' ')}><path d="M12 3a9 9 0 1 0 9 9" /></Svg>;
