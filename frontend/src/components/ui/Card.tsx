import { type FC, type ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card: FC<CardProps> = ({ children, className = "" }) => (
  <div
    className={`rounded-xl border border-slate-200/90 bg-white shadow-sm ${className}`.trim()}
  >
    {children}
  </div>
);
