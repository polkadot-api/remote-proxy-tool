import { Button } from "@/components/ui/button";
import { stringify } from "@/lib/json";
import { accId, genericSS58 } from "@/lib/ss58";
import { dot } from "@polkadot-api/descriptors";
import { Binary, Blake2256 } from "@polkadot-api/substrate-bindings";
import { state, useStateObservable } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { TriangleAlert } from "lucide-react";
import { InvalidTxError, TxEvent } from "polkadot-api";
import { FC } from "react";
import {
  catchError,
  combineLatest,
  exhaustMap,
  map,
  of,
  switchMap,
  withLatestFrom,
} from "rxjs";
import { tx$ } from "./CallData";
import { selectedAccount$ } from "./SelectAccount";
import { client$, clients$ } from "./SelectChain";
import { multisigAccount$, proxyAddress$ } from "./SelectProxy";

const multisigProxySigner$ = state(
  combineLatest([
    selectedAccount$,
    proxyAddress$,
    multisigAccount$,
    clients$,
  ]).pipe(
    map(([selectedAccount, proxyAddress, multisigAccount, clients]) => {
      if (!selectedAccount || !proxyAddress || !multisigAccount || !clients)
        return null;

      return clients.sdk.getMultisigProxiedSigner(
        proxyAddress,
        {
          threshold: multisigAccount.threshold,
          signatories: multisigAccount.addresses,
        },
        selectedAccount.polkadotSigner
      );
    })
  ),
  null
);

const wrappedTx$ = combineLatest([
  client$,
  proxyAddress$,
  tx$.pipe(map((tx) => tx?.decodedCall ?? null)),
]).pipe(
  map(([client, proxyAddr, tx]) =>
    tx && client && proxyAddr
      ? client
          .getUnsafeApi()
          .tx.RemoteProxyRelayChain.remote_proxy_with_registered_proof({
            real: {
              type: "Id",
              value: proxyAddr,
            },
            call: tx,
          })
      : null
  )
);

export const multisigCall$ = state(
  combineLatest([
    client$,
    wrappedTx$.pipe(
      switchMap((tx) => tx?.getEncodedData() ?? of(null)),
      map((v) => (v ? Blake2256(v.asBytes()) : null))
    ),
    multisigAccount$,
  ]).pipe(
    switchMap(([client, callHash, account]) => {
      if (!client || !callHash || !account) return of(null);

      return client
        .getUnsafeApi<typeof dot>()
        .query.Multisig.Multisigs.watchValue(
          account.multisigId,
          Binary.fromBytes(callHash)
        );
    })
  ),
  null
);

const hasAlreadyApproved$ = state(
  combineLatest([multisigCall$, multisigAccount$, selectedAccount$]).pipe(
    map(([multisigCall, multisig, selectedSigner]) => {
      if (!multisigCall || !multisig || !selectedSigner) return false;
      const signerSs58 = accId.dec(selectedSigner.polkadotSigner.publicKey);

      // if we have reached the threshold, don't mark it as "already approved", because it needs another call to get it executed.
      return (
        multisigCall.approvals.length < multisig.threshold &&
        multisigCall.approvals.some(
          (approval) => genericSS58(approval) === signerSs58
        )
      );
    })
  ),
  false
);

const isReady$ = state(
  combineLatest([multisigProxySigner$, tx$]).pipe(
    map(([signer, tx]) => Boolean(signer && tx))
  ),
  false
);

const [submit$, submit] = createSignal();
const txStatus$ = state(
  submit$.pipe(
    withLatestFrom(multisigProxySigner$, tx$),
    exhaustMap(([, signer, tx]) => {
      if (!signer || !tx) return of(null);
      return tx.signSubmitAndWatch(signer).pipe(
        catchError((err) => {
          console.error(err);
          if (err instanceof InvalidTxError) {
            return of({
              type: "invalid" as const,
              value: err.error,
            });
          }
          return of({
            type: "error" as const,
            value: err?.message ?? "Uknown", // For the lore
          });
        })
      );
    })
  ),
  null
);

export const Submit = () => {
  const isReady = useStateObservable(isReady$);
  const txStatus = useStateObservable(txStatus$);
  const hasAlreadyApproved = useStateObservable(hasAlreadyApproved$);

  return (
    <div className="p-2 space-y-2">
      <Button
        disabled={
          !isReady ||
          !!(
            txStatus &&
            !["error", "invalid", "finalized"].includes(txStatus.type)
          ) ||
          hasAlreadyApproved
        }
        onClick={submit}
      >
        Submit
      </Button>
      {hasAlreadyApproved ? (
        <div className="text-orange-600">
          <TriangleAlert className="inline-block align-baseline" size={20} />{" "}
          The selected account has already approved this multisig call
        </div>
      ) : null}
      {txStatus ? <TxStatus status={txStatus} /> : null}
    </div>
  );
};

const TxStatus: FC<{
  status: TxEvent | { type: "invalid" | "error"; value: any };
}> = ({ status }) => {
  const renderContent = () => {
    switch (status.type) {
      case "error":
        return <div className="text-sm">Submission failed! {status.value}</div>;
      case "signed":
        return (
          <div className="text-sm text-muted-foreground">
            Transaction signed, validating…
          </div>
        );
      case "invalid":
        return (
          <div className="text-sm">
            Validation failed! <code>{stringify(status.value)}</code>
          </div>
        );
      case "broadcasted":
        return (
          <div className="text-sm text-muted-foreground">
            The transaction has been sent, waiting to get it included in a
            block…
          </div>
        );
      case "txBestBlocksState":
        if (!status.found) return null;
        return status.ok ? (
          <div>
            The transaction has been included in a block, waiting for
            confirmation…
          </div>
        ) : (
          <div>
            The transaction has been included in a block but it's failing:{" "}
            <code>{stringify(status.dispatchError)}</code>, waiting for
            confirmation…
          </div>
        );
      case "finalized":
        return status.ok ? (
          <div>Transaction succeeded!</div>
        ) : (
          <div>
            Transaction failed: <code>{stringify(status.dispatchError)}</code>
          </div>
        );
    }
  };

  return (
    <div>
      <div>Status: {status.type}</div>
      {renderContent()}
    </div>
  );
};
