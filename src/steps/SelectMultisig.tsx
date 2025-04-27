import { AccountInput } from "@/components/AccountSelector/AccountInput";
import { OnChainIdentity } from "@/components/AccountSelector/OnChainIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHashParam, setHashParam } from "@/lib/hashParams";
import { accId } from "@/lib/ss58";
import type { dot } from "@polkadot-api/descriptors";
import { novasamaProvider } from "@polkadot-api/sdk-accounts";
import {
  Binary,
  Blake2256,
  getMultisigAccountId,
} from "@polkadot-api/substrate-bindings";
import { state, Subscribe, useStateObservable } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { Trash2 } from "lucide-react";
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

const initialSignatories = getHashParam("signatories");
const [modeChange$, setMode] = createSignal<"multisig" | "signatories">();
const mode$ = state(
  modeChange$,
  initialSignatories ? "signatories" : "multisig"
);

const [multisigAddressChange$, setMultisigAddress] = createSignal<string>();
const multisigAddress$ = state(
  multisigAddressChange$.pipe(
    tap((v) => {
      setHashParam("multisigaddr", v);
      setHashParam("signatories", null);
    })
  ),
  getHashParam("multisigaddr") ?? null
);

interface Multisig {
  addresses: string[];
  threshold: number;
}
const [multisigSignatoriesChange$, setMultisigSignatories] =
  createSignal<Multisig>();
const multisigSignatories$ = state(
  multisigSignatoriesChange$.pipe(
    tap((v) => {
      setHashParam("multisigaddr", null);
      setHashParam("signatories", JSON.stringify(v));
    })
  ),
  initialSignatories ? (JSON.parse(initialSignatories) as Multisig) : null
);

const multisig$ = state(
  combineLatest([mode$, multisigAddress$, multisigSignatories$]).pipe(
    switchMap(([mode, address, multisig]) => {
      if (mode === "signatories") {
        return of(
          multisig &&
            multisig.addresses.length >= 2 &&
            multisig.threshold <= multisig.addresses.length
            ? {
                type: "found" as const,
                value: multisig,
              }
            : null
        );
      }
      return address
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
        : of(null);
    })
  ),
  null
);

export const multisigAccount$ = multisig$.pipeState(
  map((v) => v?.value ?? null),
  map((v) => {
    if (!v) return null;
    return {
      ...v,
      multisigId: accId.dec(
        getMultisigAccountId({
          threshold: v.threshold,
          signatories: v.addresses.map(accId.enc),
        })
      ),
    };
  }),
  startWith(null)
);

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
  const mode = useStateObservable(mode$);
  const multisig = useStateObservable(multisig$);
  const multisigCall = useStateObservable(multisigCall$);

  return (
    <div className="p-2">
      <div className="space-y-1 mb-2">
        <div className="flex gap-4">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={mode === "multisig"}
              onChange={() => setMode("multisig")}
            />
            <div className="py-1">From Multisig Address</div>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={mode === "signatories"}
              onChange={() => setMode("signatories")}
            />
            <div className="py-1">From Signatories</div>
          </label>
        </div>
        {mode === "multisig" ? <FromMultisigAddress /> : <FromSignatories />}
      </div>
      {multisig?.type === "found" ? (
        multisigCall ? (
          <div>
            This multisig call has already started,{" "}
            {multisigCall.approvals.length} out of {multisig.value.threshold}{" "}
            approvals so far.
          </div>
        ) : (
          <div>
            You will create this multisig call as it seems no one else from the
            group has started it yet.
          </div>
        )
      ) : null}
    </div>
  );
};

const FromMultisigAddress = () => {
  const multisig = useStateObservable(multisig$);
  const multisigAddress = useStateObservable(multisigAddress$);

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">
        (Needs to have successfully submitted an initial transaction)
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
        <div className="text-orange-600">Not a multisig or not indexed yet</div>
      ) : null}
      {multisigAddress && !multisig ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : null}
    </div>
  );
};

const FromSignatories = () => {
  const multisig = useStateObservable(multisigSignatories$) ?? {
    threshold: 1,
    addresses: [],
  };

  return (
    <div className="space-y-1">
      <div className="p-2 shadow rounded">
        <div className="flex items-center gap-2">
          <div>Add Signatory</div>
          <Subscribe fallback={null}>
            <AccountInput
              className="my-2"
              value={null}
              onChange={(account) =>
                setMultisigSignatories({
                  ...multisig,
                  addresses: [...new Set([...multisig.addresses, account])],
                })
              }
            />
          </Subscribe>
        </div>
        <ul>
          {multisig.addresses.map((addr) => (
            <li key={addr} className="flex items-center gap-2 py-1">
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive has-[>svg]:px-2 p-1 h-auto w-auto"
                onClick={() => {
                  setMultisigSignatories({
                    ...multisig,
                    addresses: multisig.addresses.filter((v) => v !== addr),
                  });
                }}
              >
                <Trash2 />
              </Button>
              <OnChainIdentity value={addr} />
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2 justify-start">
          <div>Threshold</div>
          <Input
            className="w-auto"
            type="number"
            min="1"
            value={multisig.threshold}
            onChange={(evt) => {
              setMultisigSignatories({
                ...multisig,
                threshold: Math.floor(evt.target.valueAsNumber),
              });
            }}
          />
        </label>
      </div>
      {multisig.addresses.length < 2 ? (
        <div className="text-orange-600">
          Multisig needs at least 2 members!
        </div>
      ) : multisig.threshold > multisig.addresses.length ? (
        <div className="text-orange-600">
          Multisig threshold can't be higher than the amount of members!
        </div>
      ) : (
        <div>
          <div>Resulting multisig address:</div>
          <OnChainIdentity
            value={accId.dec(
              getMultisigAccountId({
                threshold: multisig.threshold,
                signatories: multisig.addresses.map(accId.enc),
              })
            )}
          />
        </div>
      )}
    </div>
  );
};
