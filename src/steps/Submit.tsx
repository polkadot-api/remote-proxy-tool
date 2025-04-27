import { Button } from "@/components/ui/button";
import { dot } from "@polkadot-api/descriptors";
import { getMultisigSigner } from "@polkadot-api/meta-signers";
import { state, useStateObservable } from "@react-rxjs/core";
import {
  catchError,
  combineLatest,
  exhaustMap,
  map,
  of,
  withLatestFrom,
} from "rxjs";
import { tx$ } from "./CallData";
import { selectedSigner$ } from "./SelectAccount";
import { client$ } from "./SelectChain";
import { multisigAccount$, multisigCall$ } from "./SelectMultisig";
import { createSignal } from "@react-rxjs/utils";
import { accId, genericSS58 } from "@/lib/ss58";
import { TriangleAlert } from "lucide-react";

const multisigSigner$ = state(
  combineLatest([client$, multisigAccount$, selectedSigner$]).pipe(
    map(([client, multisigAccount, selectedSigner]) => {
      if (!client || !multisigAccount || !selectedSigner) return null;

      const unsafeApi = client.getUnsafeApi<typeof dot>();
      return getMultisigSigner(
        {
          threshold: multisigAccount.threshold,
          signatories: multisigAccount.addresses,
        },
        unsafeApi.query.Multisig.Multisigs.getValue,
        unsafeApi.apis.TransactionPaymentApi.query_info,
        selectedSigner
      );
    })
  ),
  null
);

const hasAlreadyApproved$ = state(
  combineLatest([multisigCall$, selectedSigner$]).pipe(
    map(([multisigCall, selectedSigner]) => {
      if (!multisigCall || !selectedSigner) return false;
      const signerSs58 = accId.dec(selectedSigner.publicKey);

      return multisigCall.approvals.some(
        (approval) => genericSS58(approval) === signerSs58
      );
    })
  ),
  false
);

const isReady$ = state(
  combineLatest([multisigSigner$, tx$]).pipe(
    map(([signer, tx]) => Boolean(signer && tx))
  ),
  false
);

const [submit$, submit] = createSignal();
const txStatus$ = state(
  submit$.pipe(
    withLatestFrom(multisigSigner$, tx$),
    exhaustMap(([, signer, tx]) => {
      if (!signer || !tx) return of(null);
      return tx.signSubmitAndWatch(signer).pipe(
        catchError((err) => {
          console.error(err);
          return of(null);
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
        disabled={!isReady || !!txStatus || hasAlreadyApproved}
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
      {txStatus ? <div>Status: {txStatus.type}</div> : null}
    </div>
  );
};
