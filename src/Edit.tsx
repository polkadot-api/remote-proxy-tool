import { state, useStateObservable } from "@react-rxjs/core";
import { combineLatest, firstValueFrom, map } from "rxjs";
import { Step } from "./components/Step";
import { Button } from "./components/ui/button";
import { setHashParams } from "./lib/hashParams";
import { genericSS58 } from "./lib/ss58";
import { setMode } from "./mode";
import { CallData, rawCallData$, tx$ } from "./steps/CallData";
import { SelectAccount, selectedAccount$ } from "./steps/SelectAccount";
import { SelectChain, selectedChain$ } from "./steps/SelectChain";
import { proxyAddress$, proxySigners$, SelectProxy } from "./steps/SelectProxy";
import { Submit } from "./steps/Submit";

export const Edit = () => {
  const isReady = useStateObservable(isReady$);
  const submitAction = useStateObservable(submitAction$);

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
      <Step title="3. Select Signer">
        <SelectAccount />
      </Step>
      <hr />
      <Step title="4. Call Data">
        <CallData />
      </Step>
      <hr />
      {submitAction ? (
        submitAction.type === "multisig" ? (
          <Button
            disabled={!isReady}
            onClick={async () => {
              await setUrl();
              setMode("submit");
            }}
          >
            Generate call URL
          </Button>
        ) : (
          <Submit />
        )
      ) : null}
    </div>
  );
};

const submitAction$ = state(
  combineLatest([selectedAccount$, proxyAddress$, proxySigners$]).pipe(
    map(([selectedAccount, proxyAddress, proxySigners]) => {
      if (!selectedAccount || !proxyAddress || !proxySigners) return null;

      const signerInfo = proxySigners.find(
        (signer) => genericSS58(selectedAccount.address) === signer.address
      );
      if (!signerInfo) return null;

      return signerInfo.multisig
        ? {
            type: "multisig" as const,
            proxyAddress,
            multisig: signerInfo.multisig,
          }
        : {
            type: "direct" as const,
          };
    })
  ),
  null
);

const isReady$ = state(
  combineLatest([selectedChain$, tx$, submitAction$]).pipe(
    map((v) => v.every((v) => v))
  ),
  false
);

const setUrl = async () => {
  const [chain, callData, submitAction] = await Promise.all([
    firstValueFrom(selectedChain$),
    firstValueFrom(rawCallData$),
    firstValueFrom(submitAction$),
  ]);
  if (submitAction?.type !== "multisig") return;

  setHashParams({
    ...chain,
    calldata: callData,
    proxy: submitAction.proxyAddress,
    signatories: submitAction.multisig.addresses.join("_"),
    threshold: String(submitAction.multisig.threshold),
  });
};
