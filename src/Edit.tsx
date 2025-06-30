import { state, useStateObservable } from "@react-rxjs/core";
import { combineLatest, firstValueFrom, map } from "rxjs";
import { Step } from "./components/Step";
import { Button } from "./components/ui/button";
import { setHashParams } from "./lib/hashParams";
import { genericSS58 } from "./lib/ss58";
import { setMode } from "./mode";
import { CallData, rawCallData$, tx$ } from "./steps/CallData";
import { SelectAccount, selectedAccount$ } from "./steps/SelectAccount";
import { clients$, SelectChain, selectedChain$ } from "./steps/SelectChain";
import { proxyAddress$, proxySigners$, SelectProxy } from "./steps/SelectProxy";

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
      {submitAction && (
        <div className="text-right">
          {submitAction.type === "multisig" ? (
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
            <Button>Sign and submit</Button>
          )}
        </div>
      )}
    </div>
  );
};

const submitAction$ = state(
  combineLatest([
    selectedAccount$,
    proxyAddress$,
    proxySigners$,
    clients$,
  ]).pipe(
    map(([selectedAccount, proxyAddress, proxySigners, clients]) => {
      if (!selectedAccount || !proxyAddress || !proxySigners || !clients)
        return null;

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
            signer: clients.sdk.getProxiedSigner(
              proxyAddress,
              selectedAccount.polkadotSigner
            ),
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
