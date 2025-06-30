import { state, useStateObservable } from "@react-rxjs/core";
import { combineLatest, firstValueFrom, map } from "rxjs";
import { Step } from "./components/Step";
import { Button } from "./components/ui/button";
import { setHashParams } from "./lib/hashParams";
import { setMode } from "./mode";
import { CallData, rawCallData$, tx$ } from "./steps/CallData";
import { SelectChain, selectedChain$ } from "./steps/SelectChain";
import {
  multisigAccount$,
  multisigSignatories$,
  SelectMultisig,
} from "./steps/SelectMultisig";
import { SelectProxy } from "./steps/SelectProxy";

const isReady$ = state(
  combineLatest([selectedChain$, tx$, multisigAccount$]).pipe(
    map((v) => v.every((v) => v))
  ),
  false
);

const setUrl = async () => {
  const [chain, callData, multisig] = await Promise.all([
    firstValueFrom(selectedChain$),
    firstValueFrom(rawCallData$),
    firstValueFrom(multisigSignatories$),
  ]);
  setHashParams({
    ...chain,
    calldata: callData,
    signatories: multisig!.addresses.join("_"),
    threshold: String(multisig!.threshold),
  });
};

export const Edit = () => {
  const isReady = useStateObservable(isReady$);

  return (
    <div className="p-2 space-y-2">
      <Step title="1. Select Chain">
        <SelectChain />
      </Step>
      <hr />
      <Step title="2. Select Proxy">
        <SelectProxy />
      </Step>
      <hr />
      <Step title="3. Call Data">
        <CallData />
      </Step>
      <hr />
      <div className="text-right">
        <Button
          disabled={!isReady}
          onClick={async () => {
            await setUrl();
            setMode("submit");
          }}
        >
          Generate call URL
        </Button>
      </div>
    </div>
  );
};
