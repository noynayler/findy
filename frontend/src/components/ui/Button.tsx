import {
  type ButtonHTMLAttributes,
  type FC,
  type ReactNode,
} from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-950 focus-visible:ring-slate-900 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 focus-visible:ring-slate-400 disabled:opacity-50",
  ghost:
    "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400 disabled:opacity-50",
};

const base =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed";

export const Button: FC<ButtonProps> = ({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}) => (
  <button
    type={type}
    className={`${base} ${variantClasses[variant]} ${className}`.trim()}
    {...props}
  />
);
