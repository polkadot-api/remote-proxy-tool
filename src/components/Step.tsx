import { FC, PropsWithChildren } from "react";

export const Step: FC<
  PropsWithChildren<{
    number: number;
    title: string;
    subtitle?: string;
  }>
> = ({ title, number, subtitle, children }) => (
  <div className="bg-background p-4 rounded-lg shadow">
    <div className="flex items-center gap-3 mb-2">
      <div className="bg-primary text-primary-foreground rounded-full grow-0 shrink-0 w-8 h-8 leading-8 text-center">
        {number}
      </div>
      <div>
        <h2 className="text-xl font-bold m-0 leading-none">{title}</h2>
        {subtitle ? (
          <h4 className="text-xs text-foreground/60">{subtitle}</h4>
        ) : null}
      </div>
    </div>
    {children}
  </div>
);
