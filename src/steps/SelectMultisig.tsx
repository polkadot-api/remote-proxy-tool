import { AccountInput } from "@/components/AccountSelector/AccountInput";
import { OnChainIdentity } from "@/components/AccountSelector/OnChainIdentity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getHashParam } from "@/lib/hashParams";
import { accId } from "@/lib/ss58";
import type { dot } from "@polkadot-api/descriptors";
import { novasamaProvider } from "@polkadot-api/sdk-accounts";
import {
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
import { Trash2 } from "lucide-react";
import { FC, useState } from "react";
import {
  combineLatest,
  EMPTY,
  from,
  map,
  of,
  startWith,
  switchMap,
} from "rxjs";
import { tx$ } from "./CallData";
import { client$ } from "./SelectChain";

const initialSignatories = getHashParam("signatories");
const initialThreshold = getHashParam("threshold");

export const initialHasMultisig = !!(initialSignatories && initialThreshold);

interface Multisig {
  addresses: string[];
  threshold: number;
}
const [multisigSignatoriesChange$, setMultisigSignatories] =
  createSignal<Multisig>();
export const multisigSignatories$ = state(
  multisigSignatoriesChange$,
  initialSignatories
    ? {
        addresses: initialSignatories.split("_"),
        threshold: initialThreshold ? Number(initialThreshold) : 1,
      }
    : null
);

const multisig$ = state(
  multisigSignatories$.pipe(
    map((multisig) =>
      multisig &&
      multisig.addresses.length >= 2 &&
      multisig.threshold <= multisig.addresses.length
        ? {
            type: "found" as const,
            value: multisig,
          }
        : null
    )
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
  combineLatest([
    client$,
    tx$.pipe(
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

export const SelectMultisig = () => {
  return (
    <div className="p-2">
      <FromSignatories />
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
      <ImportIndexed />
      <div>
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
        <div className="text-orange-600">Multisig needs at least 2 members</div>
      ) : multisig.threshold > multisig.addresses.length ? (
        <div className="text-orange-600">
          Multisig threshold can't be higher than the amount of members
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2">
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

const ImportIndexed = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Import existing multisig</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import existing multisig</DialogTitle>
          <DialogDescription>
            If you have a multisig that has already been indexed, you can import
            it to have all signatories and threshold filled out
          </DialogDescription>
        </DialogHeader>
        <ImportIndexedContent onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

const [importMultisigAddrChange$, importMultisigAddr] = createSignal<string>();
const importMultisigAddr$ = state(importMultisigAddrChange$, null);

const importSignatories$ = importMultisigAddr$.pipeState(
  switchMap((v) =>
    (v
      ? from(novasamaProvider(v)).pipe(
          map((result) => ({
            result,
          }))
        )
      : EMPTY
    ).pipe(startWith(null))
  ),
  withDefault(null)
);

const ImportIndexedContent: FC<{ onDone: () => void }> = ({ onDone }) => {
  const addr = useStateObservable(importMultisigAddr$);
  const importedSignatories = useStateObservable(importSignatories$);

  return (
    <div className="space-y-2">
      <Subscribe fallback={null}>
        <AccountInput value={addr} onChange={importMultisigAddr} />
      </Subscribe>
      {importedSignatories?.result ? (
        <div className="space-y-2">
          <div>
            <h4>
              Signatories (threshold {importedSignatories.result.threshold})
            </h4>
            <ul>
              {importedSignatories.result.addresses.map((address) => (
                <li key={address}>
                  <OnChainIdentity value={address} />
                </li>
              ))}
            </ul>
          </div>
          <div className="text-right">
            <Button
              onClick={() => {
                if (!importedSignatories.result) return;
                setMultisigSignatories(importedSignatories.result);
                onDone();
              }}
            >
              Import
            </Button>
          </div>
        </div>
      ) : null}
      {importedSignatories?.result === null ? (
        <div className="text-orange-600">Not a multisig or not indexed yet</div>
      ) : null}
      {addr && !importedSignatories ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : null}
    </div>
  );
};
