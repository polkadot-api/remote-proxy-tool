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
    chain: `${chain.type}-${chain.value}`,
    calldata: callData,
    signatories: multisig!.addresses.join("_"),
    threshold: String(multisig!.threshold),
  });
};

export const Edit = () => {
  const isReady = useStateObservable(isReady$);

  return (
    <div className="p-2 space-y-4">
      <Step
        number={1}
        title="Select Chain"
        subtitle="Choose a chain o provide a custom RPC URL"
      >
        <SelectChain />
      </Step>
      <Step
        number={2}
        title="Select Multisig"
        subtitle="Import or enter the multisig details"
      >
        <SelectMultisig />
      </Step>
      <Step
        number={3}
        title="Call Data"
        subtitle="Create the transaction payload to be executed"
      >
        <CallData />
      </Step>
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
