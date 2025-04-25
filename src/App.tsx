import { FC, PropsWithChildren } from "react";
import { CallData } from "./steps/CallData";
import { SelectAccount } from "./steps/SelectAccount";
import { SelectChain } from "./steps/SelectChain";
import { SelectMultisig } from "./steps/SelectMultisig";
import { Submit } from "./steps/Submit";

function App() {
  return (
    <div className="p-2">
      <h1 className="font-bold text-2xl border-b p-2">PAPI Multisig Tool</h1>
      <div className="p-2 space-y-2">
        <Step title="1. Select Chain">
          <SelectChain />
        </Step>
        <Step title="2. Call Data">
          <CallData />
        </Step>
        <Step title="3. Select Multisig">
          <SelectMultisig />
        </Step>
        <Step title="4. Select Account">
          <SelectAccount />
        </Step>
        <Step title="5. Submit">
          <Submit />
        </Step>
      </div>
    </div>
  );
}

const Step: FC<
  PropsWithChildren<{
    title: string;
  }>
> = ({ title, children }) => (
  <div>
    <h2 className="text-xl">{title}</h2>
    {children}
  </div>
);

export default App;
