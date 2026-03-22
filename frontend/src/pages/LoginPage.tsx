import { type FC } from "react";
import { Card } from "../components/ui/Card";

export const LoginPage: FC = () => {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Card className="p-8 text-center sm:p-10">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Log in
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
          Account sign-in is coming soon. You can use Findy without an account: upload your CV and
          search jobs from the home page.
        </p>
      </Card>
    </main>
  );
};
