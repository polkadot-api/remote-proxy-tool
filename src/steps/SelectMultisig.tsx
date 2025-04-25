import { AccountInput } from "@/components/AccountSelector/AccountInput";
import { OnChainIdentity } from "@/components/AccountSelector/OnChainIdentity";
import { getHashParam, setHashParam } from "@/lib/hashParams";
import type { dot } from "@polkadot-api/descriptors";
import { novasamaProvider } from "@polkadot-api/sdk-accounts";
import {
  AccountId,
  Binary,
  Blake2256,
  getMultisigAccountId,
} from "@polkadot-api/substrate-bindings";
import {
  state,
  Subscribe,
  useStateObservable,
  withDefault,
} from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import {
  catchError,
  combineLatest,
  from,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from "rxjs";
import { tx$ } from "./CallData";
import { client$ } from "./SelectChain";

const [multisigAddressChange$, setMultisigAddress] = createSignal<string>();
const multisigAddress$ = state(
  multisigAddressChange$.pipe(tap((v) => setHashParam("multisigaddr", v))),
  getHashParam("multisigaddr") ?? null
);

const multisig$ = multisigAddress$.pipeState(
  switchMap((address) =>
    address
      ? from(novasamaProvider(address)).pipe(
          catchError((err) => {
            console.error(err);
            return of(null);
          }),
          map((value) =>
            value
              ? {
                  type: "found" as const,
                  value,
                }
              : {
                  type: "not-found" as const,
                }
          ),
          startWith(null)
        )
      : of(null)
  ),
  withDefault(null)
);

export const multisigAccount$ = multisig$.pipeState(
  map((v) => v?.value ?? null),
  map((v) => {
    if (!v) return null;
    return {
      ...v,
      multisigId: acc.dec(
        getMultisigAccountId({
          threshold: v.threshold,
          signatories: v.addresses.map(acc.enc),
        })
      ),
    };
  }),
  startWith(null)
);

const acc = AccountId();
export const multisigCall$ = state(
  combineLatest([client$, tx$, multisigAccount$]).pipe(
    switchMap(async ([client, tx, account]) => {
      if (!client || !tx || !account) return null;

      const callHash = Blake2256((await tx.getEncodedData()).asBytes());

      return client
        .getUnsafeApi<typeof dot>()
        .query.Multisig.Multisigs.getValue(
          account.multisigId,
          Binary.fromBytes(callHash)
        );
    })
  ),
  null
);

export const SelectMultisig = () => {
  const multisigAddress = useStateObservable(multisigAddress$);
  const multisig = useStateObservable(multisig$);
  const multisigCall = useStateObservable(multisigCall$);

  return (
    <div>
      <div className="p-2">
        <div className="space-y-1">
          <h3>From Multisig Address</h3>
          <p className="text-muted-foreground text-sm">
            (Needs to be indexed by Novasama)
          </p>
          <Subscribe fallback={null}>
            <AccountInput
              className="my-2"
              value={multisigAddress}
              onChange={setMultisigAddress}
            />
          </Subscribe>
          {multisig?.type === "found" ? (
            <div>
              <h4>Signatories (threshold {multisig.value.threshold})</h4>
              <ul>
                {multisig.value.addresses.map((address) => (
                  <li key={address}>
                    <OnChainIdentity value={address} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {multisig?.type === "not-found" ? (
            <div className="text-orange-600">
              Not a multisig or not indexed yet by Novasama
            </div>
          ) : null}
          {multisigAddress && !multisig ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : null}
        </div>
      </div>
      {multisig?.type === "found" ? (
        multisigCall ? (
          <div className="p-2">
            This multisig call has already started,{" "}
            {multisigCall.approvals.length} out of {multisig.value.threshold}{" "}
            approvals so far.
          </div>
        ) : (
          <div className="p-2">
            You will create this multisig call as it seems no one else has
            started it yet.
          </div>
        )
      ) : null}
    </div>
  );
};
