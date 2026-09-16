type ActionPillProps = {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "accent";
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function ActionPill({
  onClick,
  disabled,
  variant = "default",
  children,
  ...rest
}: ActionPillProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className={
        variant === "accent"
          ? "inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-xs font-semibold text-accent-strong transition hover:bg-accent/15 disabled:opacity-50"
          : "inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-foreground/5 disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}
