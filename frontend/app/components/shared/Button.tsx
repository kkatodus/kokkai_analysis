import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Spinner } from "./states";

// DESIGN.md "Buttons": primary (one per view), secondary (everything else), ghost (inside rows and sentences).
export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "hit-target inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border text-label-md transition-colors duration-150 " +
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-raised disabled:bg-none disabled:text-ink-disabled aria-disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-primary-line bg-linear-to-br from-primary-soft to-secondary-soft text-on-primary-soft hover:from-primary-soft-hover hover:to-secondary-soft-hover",
  secondary: "border-line bg-surface-raised text-ink hover:bg-surface-hover hover:text-ink-strong",
  ghost: "border-transparent bg-transparent text-link hover:bg-surface-raised",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-3",
  md: "h-9 px-4",
  lg: "h-11 px-5 text-title-sm",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cx(base, variants[variant], sizes[size], variant === "ghost" && size !== "lg" && "px-3", className);
}

type CommonProps = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; children: ReactNode };

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean };

export function Button({ variant, size, icon, busy, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export type ButtonLinkProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** A link styled as a button. External links (http…) open in a new tab. */
export function ButtonLink({ variant, size, icon, className, children, href, ...rest }: ButtonLinkProps) {
  const cls = buttonClass(variant, size, className);
  if (/^https?:/.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} {...rest}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Japanese accessible name, also shown as the tooltip. */
  label: string;
  size?: "sm" | "md";
  children: ReactNode;
};

/** DESIGN.md "Icon": 32px circle (24px in dense toolbars), always labelled. */
export function IconButton({ label, size = "md", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "hit-target inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink-strong",
        "disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-surface-raised",
        size === "md" ? "size-8" : "size-6",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
