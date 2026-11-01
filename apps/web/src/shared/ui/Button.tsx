import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { cn } from "@/shared/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "brand";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-neutral-900 text-white shadow-lg shadow-black/10 hover:bg-neutral-800",
  secondary:
    "border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 hover:text-neutral-900",
  ghost: "text-neutral-600 hover:bg-neutral-900/[0.06] hover:text-neutral-900",
  danger: "bg-red-600 text-[#fff] hover:brightness-110",
  brand: "bg-marca text-[#06140a] shadow-lg shadow-marca/25 hover:brightness-105",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-sm",
};

const ICON_SIZES: Record<ButtonSize, string> = { sm: "size-3.5", md: "size-4", lg: "size-4" };

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícone à esquerda do texto. */
  icon?: LucideIcon;
  children?: ReactNode;
}

export interface ButtonProps extends CommonProps, Omit<ComponentProps<"button">, "children"> {
  /** Mostra o spinner, desabilita e anuncia "ocupado". */
  loading?: boolean;
}

export function Button({
  variant,
  size = "md",
  icon: Icon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading ? (
        <Spinner className={ICON_SIZES[size]} />
      ) : Icon ? (
        <Icon className={ICON_SIZES[size]} aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps, Omit<LinkProps, "children"> {}

/** Link com cara de botão (navegação, não ação). */
export function ButtonLink({
  variant,
  size = "md",
  icon: Icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {Icon ? <Icon className={ICON_SIZES[size]} aria-hidden /> : null}
      {children}
    </Link>
  );
}

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children"> {
  icon: LucideIcon;
  /** Obrigatório: é o nome do botão para leitores de tela (e a dica ao passar o mouse). */
  label: string;
  variant?: "ghost" | "secondary" | "primary" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-grid shrink-0 cursor-pointer place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "size-8" : "size-10",
        variant === "ghost" &&
          "text-neutral-500 hover:bg-neutral-900/[0.07] hover:text-neutral-900",
        variant === "secondary" &&
          "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400",
        variant === "primary" && "bg-neutral-900 text-white hover:bg-neutral-800",
        variant === "danger" && "text-red-700 hover:bg-red-50",
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : <Icon className="size-4" aria-hidden />}
    </button>
  );
}
