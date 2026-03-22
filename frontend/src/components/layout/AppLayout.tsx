import { type FC } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";

export const AppLayout: FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <Outlet />
    </div>
  );
};
