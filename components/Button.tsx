// FILE: components/Button.tsx
// -----------------------------------------------------------------------------
// The one button component for the whole app (design brief Part 2.1) — no
// one-off buttons anywhere else. Two variants (primary/secondary), and the
// states the prototype's canvas-drawn buttons never had: hover, active,
// focus-visible, disabled, loading. Renders as a real <button>, or as a
// styled Next <Link> when `href` is given (e.g. the hero CTA).
// -----------------------------------------------------------------------------
"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

interface CommonProps {
  variant?: "primary" | "secondary";
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({ variant = "secondary", loading = false, loadingText, children, className, ...props }: ButtonProps) {
  const classes = [styles.button, variant === "primary" ? styles.primary : "", loading ? styles.loading : "", className]
    .filter(Boolean)
    .join(" ");

  const content = loading ? (loadingText ?? children) : children;

  if ("href" in props && props.href !== undefined) {
    const { href, ...anchorProps } = props as ButtonAsLink;
    return (
      <Link href={href} className={classes} aria-disabled={loading} {...anchorProps}>
        {content}
      </Link>
    );
  }

  const { disabled, ...buttonProps } = props as ButtonAsButton;
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading} {...buttonProps}>
      {content}
    </button>
  );
}
