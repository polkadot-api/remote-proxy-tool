import { AccountInput } from "@/components/AccountSelector/AccountInput";
import { OnChainIdentity } from "@/components/AccountSelector/OnChainIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHashParam } from "@/lib/hashParams";
import { accId } from "@/lib/ss58";
import { dot } from "@polkadot-api/descriptors";
import { novasamaProvider } from "@polkadot-api/sdk-accounts";
import {
  getMultisigAccountId,
  SS58String,
} from "@polkadot-api/substrate-bindings";
import { toHex } from "@polkadot-api/utils";
import {
  state,
  Subscribe,
  useStateObservable,
  withDefault,
} from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { Trash2 } from "lucide-react";
import { combineLatest, filter, from, map, startWith, switchMap } from "rxjs";
import { clients$ } from "./SelectChain";

const getMultisig = novasamaProvider("kusama");

const initialProxy = getHashParam("proxy");
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

const ProxyDelegates = () => {
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
    <ul>
      {delegates.map((d, i) => (
        <li key={i}>
          <OnChainIdentity value={d.delegate} />
          {multisigDelegates?.[d.delegate] ? (
            <div>
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
  );
};

const initialSignatories = getHashParam("signatories");
const initialThreshold = getHashParam("threshold");

interface Multisig {
  addresses: string[];
  threshold: number;
}
const [multisigSignatoriesChange$, setMultisigSignatories] =
  createSignal<Multisig | null>();
const multisigSignatories$ = state(
  multisigSignatoriesChange$,
  initialSignatories
    ? {
        addresses: initialSignatories.split("_"),
        threshold: initialThreshold ? Number(initialThreshold) : 1,
      }
    : null
);

const ManualMultisig = () => {
  const multisig = useStateObservable(multisigSignatories$);
  const delegates = useStateObservable(proxyDelegates$);

  const accountId =
    multisig &&
    getMultisigAccountId({
      threshold: multisig.threshold,
      signatories: multisig.addresses.map(accId.enc),
    });

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
                    addresses: [],
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
              Multisig needs at least 2 members
            </div>
          ) : multisig.threshold > multisig.addresses.length ? (
            <div className="text-orange-600">
              Multisig threshold can't be higher than the amount of members
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 py-2">
                <div>Resulting multisig address:</div>
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
