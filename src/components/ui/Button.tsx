import Link from "next/link";

export type ButtonVariant = "primary" | "accent" | "ghost" | "inverse" | "ghostInverse";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-green-700 text-white hover:bg-green-500",
  accent: "bg-red-700 text-white hover:bg-red-700/90",
  ghost: "border border-line bg-paper text-green-900 hover:bg-green-100",
  // For buttons sitting on the dark green field. Overriding `primary` or `ghost`
  // with classNames does not work reliably: both sets of utilities end up in the
  // stylesheet, and which one wins is Tailwind's output order, not the class
  // attribute — which is how a white button with white text reached a screenshot.
  inverse: "bg-white text-green-900 hover:bg-green-100",
  ghostInverse: "border border-green-100/50 bg-transparent text-white hover:bg-white/10",
};

const SIZE = {
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
} as const;

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[4px] font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60";

type CommonProps = {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE;
  className?: string;
  children: React.ReactNode;
};

type LinkProps = CommonProps & { href: string } & Omit<React.ComponentProps<typeof Link>, "href">;
type HtmlButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { href?: undefined };

export function Button(props: LinkProps | HtmlButtonProps) {
  const { variant = "primary", size = "md", className = "", children, ...rest } = props;
  const classes = `${BASE} ${SIZE[size]} ${VARIANT[variant]} ${className}`;

  if ("href" in props && props.href !== undefined) {
    const { href, ...linkRest } = rest as Omit<LinkProps, keyof CommonProps>;
    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as HtmlButtonProps)}>
      {children}
    </button>
  );
}
