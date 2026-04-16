import { useTheme } from "../../theme/ThemeProvider";

type BrandMarkProps = {
  variant: "lockup" | "mark";
  className?: string;
  alt?: string;
};

const SOURCES: Record<BrandMarkProps["variant"], { light: string; dark: string }> = {
  lockup: {
    light: "/brand/dempsey-lockup.svg",
    dark: "/brand/dempsey-lockup-light.svg",
  },
  mark: {
    light: "/brand/dempsey-mark.svg",
    dark: "/brand/dempsey-mark-light.svg",
  },
};

export function BrandMark({ variant, className, alt = "Dempsey" }: BrandMarkProps) {
  const { theme } = useTheme();
  const src = theme === "dark" ? SOURCES[variant].dark : SOURCES[variant].light;
  return <img src={src} alt={alt} className={className} />;
}

export function VisionDataMark({ className }: { className?: string }) {
  return <img src="/brand/vdata-v.svg" alt="Vision Data" className={className} />;
}
