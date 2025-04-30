import { FC, PropsWithChildren } from "react";

export const Step: FC<
  PropsWithChildren<{
    title?: string;
  }>
> = ({ title, children }) => (
  <div>
    <h2 className="text-xl">{title}</h2>
    {children}
  </div>
);
