import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

/* ---------------- Button ---------------- */
type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "secondary"
type ButtonSize = "sm" | "md" | "lg" | "icon"

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
  outline:
    "border border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  danger: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
}
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-md px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 rounded-md px-6 text-base",
  icon: "size-9",
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ---------------- Card ---------------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      {children}
    </div>
  )
}
export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-col gap-1 border-b border-border px-6 py-4", className)}>{children}</div>
}
export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn("font-semibold leading-none tracking-tight", className)}>{children}</h3>
}
export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
}
export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>
}

/* ---------------- Form ---------------- */
export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-foreground", className)}>{children}</label>
}

export function Field({
  label,
  error,
  children,
}: {
  label?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="mb-4">
      {label ? <Label>{label}</Label> : null}
      {children}
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

const inputBase =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return <input className={cn(inputBase, "h-9", className)} {...rest} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props
  return <textarea className={cn(inputBase, "min-h-24", className)} {...rest} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props
  return (
    <select className={cn(inputBase, "h-9 appearance-none", className)} {...rest}>
      {children}
    </select>
  )
}

/* ---------------- Feedback ---------------- */
type AlertVariant = "info" | "success" | "error" | "warning"
const alertVariants: Record<AlertVariant, string> = {
  info: "bg-primary/5 text-foreground border-primary/20",
  success:
    "bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-foreground border-[color-mix(in_oklch,var(--success)_30%,transparent)]",
  error: "bg-destructive/8 text-destructive border-destructive/25",
  warning:
    "bg-[color-mix(in_oklch,var(--warning)_14%,transparent)] text-foreground border-[color-mix(in_oklch,var(--warning)_35%,transparent)]",
}
export function Alert({
  variant = "info",
  children,
  className,
}: {
  variant?: AlertVariant
  children: ReactNode
  className?: string
}) {
  if (!children) return null
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", alertVariants[variant], className)}>
      {children}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      aria-hidden
    />
  )
}

type BadgeTone = "brand" | "slate" | "green" | "red" | "amber"
const badgeTones: Record<BadgeTone, string> = {
  brand: "bg-primary/10 text-primary",
  slate: "bg-muted text-muted-foreground",
  green: "bg-[color-mix(in_oklch,var(--success)_15%,transparent)] text-[var(--success)]",
  red: "bg-destructive/10 text-destructive",
  amber: "bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-[var(--warning)]",
}
export function Badge({
  tone = "slate",
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone])}>
      {children}
    </span>
  )
}
