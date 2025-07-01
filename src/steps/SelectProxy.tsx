import { AccountInput } from "@/components/AccountSelector/AccountInput";
import { OnChainIdentity } from "@/components/AccountSelector/OnChainIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHashParam } from "@/lib/hashParams";
import { accId, genericSS58 } from "@/lib/ss58";
import { dot } from "@polkadot-api/descriptors";
import { novasamaProvider } from "@polkadot-api/sdk-accounts";
import {
  getMultisigAccountId,
  HexString,
  SS58String,
} from "@polkadot-api/substrate-bindings";
import { toHex } from "@polkadot-api/utils";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { Plus, Trash2 } from "lucide-react";
import { combineLatest, filter, from, map, startWith, switchMap } from "rxjs";
import { clients$ } from "./SelectChain";

const getMultisig = novasamaProvider("kusama");

const initialProxy = getHashParam("proxy");
export const hasInitialProxy = !!initialProxy;

const [proxyAddrChange$, setProxyAddress] = createSignal<SS58String>();
export const proxyAddress$ = state(proxyAddrChange$, initialProxy ?? null);

export const SelectProxy = () => {
  const proxy = useStateObservable(proxyAddress$);

  return (
    <div className="p-2 space-y-2">
      <AccountInput className="my-2" value={proxy} onChange={setProxyAddress} />
      {proxy ? (
        <>
          <ProxyDelegates />
          <ManualMultisig />
        </>
      ) : null}
    </div>
  );
};

const proxyDelegates$ = state(
  combineLatest({
    client: clients$.pipe(
      map((v) => v?.relayClient),
      filter((v) => !!v)
    ),
    address: proxyAddress$.pipe(filter((v) => !!v)),
  }).pipe(
    switchMap(({ client, address }) =>
      from(client.getTypedApi(dot).query.Proxy.Proxies.getValue(address!)).pipe(
        startWith([null, null])
      )
    ),
    map(([delegates, _deposit]) => delegates)
  ),
  null
);

const delegateMultisigs$ = proxyDelegates$.pipeState(
  switchMap((v) => {
    if (!v) return [null];

    return combineLatest(
      v.map((d) =>
        getMultisig(d.delegate).then((res) => [d.delegate, res] as const)
      )
    ).pipe(map((results) => Object.fromEntries(results)));
  }),
  withDefault(null)
);

export const ProxyDelegates = () => {
  const delegates = useStateObservable(proxyDelegates$);
  const multisigDelegates = useStateObservable(delegateMultisigs$);

  if (!delegates) {
    return <div>Loading…</div>;
  }

  if (!delegates.length) {
    return (
      <div>Could not find this address as a proxy in the relay chain!</div>
    );
  }

  return (
    <div>
      <div>Delegates:</div>
      <ul className="pl-4">
        {delegates.map((d, i) => (
          <li key={i}>
            <OnChainIdentity value={d.delegate} />
            {multisigDelegates?.[d.delegate] ? (
              <div className="pl-4">
                <div>
                  Ackchyually a multisig threshold{" "}
                  {multisigDelegates[d.delegate]!.threshold}!
                </div>
                <ul>
                  {multisigDelegates[d.delegate]!.addresses.map((addr) => (
                    <li key={addr}>
                      <OnChainIdentity value={addr} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

const initialSignatories = getHashParam("signatories");
const initialThreshold = getHashParam("threshold");

export const hasInitialMultisig = initialSignatories && initialThreshold;

interface MultisigInput {
  addresses: (string | null)[];
  threshold: number;
}
const [multisigSignatoriesChange$, setMultisigSignatories] =
  createSignal<MultisigInput | null>();
const signatoriesArr = initialSignatories?.split("_") ?? [];
const initialAddresses =
  signatoriesArr.length >= 2
    ? signatoriesArr
    : [
        ...signatoriesArr,
        ...(new Array(2 - signatoriesArr.length).fill(null) as null[]),
      ];

const multisigSignatoriesInput$ = state(
  multisigSignatoriesChange$,
  initialSignatories
    ? {
        addresses: initialAddresses,
        threshold: initialThreshold ? Number(initialThreshold) : 1,
      }
    : null
);

const ManualMultisig = () => {
  const multisig = useStateObservable(multisigSignatoriesInput$);
  const delegates = useStateObservable(proxyDelegates$);

  const accountId =
    multisig && multisig.addresses.every((addr) => addr != null)
      ? getMultisigAccountId({
          threshold: multisig.threshold,
          signatories: multisig.addresses.map(accId.enc),
        })
      : null;

  return (
    <>
      <label className="space-x-2 border py-2 px-4 inline-block rounded">
        <input
          type="checkbox"
          checked={!!multisig}
          onChange={() =>
            setMultisigSignatories(
              multisig
                ? null
                : {
                    addresses: new Array(2).fill(null),
                    threshold: 1,
                  }
            )
          }
        />
        <span>Set multisig manually</span>
      </label>
      {multisig ? (
        <>
          <div>
            <div className="text-sm font-medium">Signatories</div>
            <ul>
              {multisig.addresses.map((addr, i) => (
                <li key={i} className="flex items-center gap-2 py-1">
                  <AccountInput
                    className="grow"
                    value={addr}
                    onChange={(account) =>
                      setMultisigSignatories({
                        ...multisig,
                        addresses: multisig.addresses.map((v, idx) =>
                          idx === i ? account : v
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive border-destructive has-[>svg]:px-2 p-1 h-auto w-auto"
                    onClick={() => {
                      setMultisigSignatories({
                        ...multisig,
                        addresses: multisig.addresses.filter(
                          (_, idx) => idx !== i
                        ),
                      });
                    }}
                    disabled={multisig.addresses.length <= 2}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setMultisigSignatories({
                  ...multisig,
                  addresses: [...multisig.addresses, null],
                })
              }
            >
              <Plus />
              Add Signatory
            </Button>
          </div>
          <label className="block">
            <div className="text-sm font-medium">Threshold</div>
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
          {multisig.addresses.filter((v) => v !== null).length < 2 ? (
            <div className="text-orange-600">
              Multisig needs at least 2 members
            </div>
          ) : multisig.threshold > multisig.addresses.length ? (
            <div className="text-orange-600">
              Multisig threshold can't be higher than the amount of members
            </div>
          ) : (
            <>
              <div>
                <div className="text-sm font-medium">
                  Resulting multisig address
                </div>
                <OnChainIdentity value={accId.dec(accountId!)} />
              </div>
              {delegates &&
              !delegates.find(
                (d) => toHex(accId.enc(d.delegate)) === toHex(accountId!)
              ) ? (
                <div className="text-orange-600">
                  Multisig is not any of the signers of this proxy
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </>
  );
};

const multisigSignatories$ = multisigSignatoriesInput$.pipeState(
  map((v) => {
    if (!v) return null;
    if (v.addresses.some((addr) => addr === null)) return null;
    const addressSet = new Set(v.addresses);
    if (addressSet.size != v.addresses.length) return null;
    if (v.threshold < 1 || v.threshold > v.addresses.length) return null;

    return {
      addresses: v.addresses as string[],
      threshold: v.threshold,
    };
  }),
  withDefault(null)
);

export const proxySigners$ = state(
  combineLatest({
    delegates: proxyDelegates$,
    multisigs: delegateMultisigs$,
    manualMultisig: multisigSignatories$,
  }).pipe(
    map(({ delegates, multisigs, manualMultisig }) => {
      const delegateAddresses = new Set<HexString>(
        (delegates?.map((d) => d.delegate) ?? []).map(genericSS58)
      );

      const manualMultisigAddress =
        manualMultisig &&
        accId.dec(
          getMultisigAccountId({
            threshold: manualMultisig.threshold,
            signatories: manualMultisig.addresses.map(accId.enc),
          })
        );

      const delegateEntries = Array.from(delegateAddresses).map((address) => ({
        address,
        multisig: null,
      }));

      const multisigEntries = [
        ...Object.values(multisigs ?? {}),
        ...(delegateAddresses.has(manualMultisigAddress!)
          ? [manualMultisig!]
          : []),
      ].flatMap(
        (multisig) =>
          multisig?.addresses.map((address) => ({
            address: genericSS58(address),
            multisig,
          })) ?? []
      );

      return [...delegateEntries, ...multisigEntries];
    })
  ),
  null
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
