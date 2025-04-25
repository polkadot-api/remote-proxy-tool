import { AccountPicker } from "@/components/AccountSelector";
import {
  availableExtensions$,
  extensionAccounts$,
  onToggleExtension,
  selectedExtensions$,
} from "@/components/AccountSelector/accounts.state";
import {
  createLinkedAccountsSdk,
  NestedLinkedAccountsResult,
  novasamaProvider,
} from "@polkadot-api/sdk-accounts";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import {
  catchError,
  combineLatest,
  concatWith,
  lastValueFrom,
  map,
  NEVER,
  of,
  shareReplay,
  switchMap,
} from "rxjs";
import { client$ } from "./SelectChain";
import { dot } from "@polkadot-api/descriptors";
import { multisigAccount$ } from "./SelectMultisig";
import { PolkadotSigner } from "polkadot-api";
import { getProxySigner } from "@polkadot-api/meta-signers";
import { CircleCheck, TriangleAlert } from "lucide-react";

const linkedAccountsSdk$ = client$.pipeState(
  map((client) =>
    client
      ? createLinkedAccountsSdk(
          client.getTypedApi(dot) as any,
          novasamaProvider
        )
      : null
  ),
  withDefault(null)
);

const [valueSelectedChange$, selectValue] = createSignal<string>();
const selectedValue$ = state(valueSelectedChange$, null);

const selectedAccount$ = selectedValue$.pipeState(
  switchMap((value) => {
    if (!value) return of(null);
    const [address, ...extensionParts] = value.split("-");
    const extension = extensionParts.join("-");
    return extensionAccounts$(extension).pipe(
      map(
        (accounts) =>
          accounts.find((account) => account.address === address) ?? null
      )
    );
  }),
  withDefault(null)
);

const linkedAccounts$ = combineLatest([
  linkedAccountsSdk$,
  multisigAccount$,
]).pipe(
  switchMap(async ([linkedAccountsSdk, multisigAccount]) => {
    if (!linkedAccountsSdk || !multisigAccount) return null;

    return lastValueFrom(
      linkedAccountsSdk.getNestedLinkedAccounts$(multisigAccount.multisigId)
    );
  }),
  catchError((err) => {
    console.log(err);
    return of(null);
  }),
  concatWith(NEVER),
  shareReplay(1)
);

export const selectedSigner$ = state(
  combineLatest([linkedAccounts$, selectedAccount$]).pipe(
    switchMap(async ([multisigLinkedAccounts, selectedAccount]) => {
      if (!multisigLinkedAccounts || !selectedAccount) return null;

      const findSigner = (
        address: string,
        result: NestedLinkedAccountsResult | null
      ): PolkadotSigner | null => {
        // TODO SS58format-insensitive
        if (address === selectedAccount.address)
          return selectedAccount.polkadotSigner;
        if (!result) return null;

        switch (result.type) {
          case "root":
            return null;
          case "multisig":
            // This won't work across multiple levels of multisig :/
            return null;
          case "proxy": {
            const innerSigner = result.value.accounts
              .map((v) => findSigner(v.address, v.linkedAccounts))
              .find((v) => !!v);

            return innerSigner
              ? getProxySigner(
                  {
                    real: address,
                  },
                  innerSigner
                )
              : null;
          }
        }
      };

      if (multisigLinkedAccounts.type !== "multisig") {
        throw new Error("Expected multisig account");
      }
      return (
        multisigLinkedAccounts.value.accounts
          .map((v) => findSigner(v.address, v.linkedAccounts))
          .find((v) => !!v) ?? null
      );
    })
  ),
  null
);

export const SelectAccount = () => {
  const availableExtensions = useStateObservable(availableExtensions$);
  const selectedExtensions = useStateObservable(selectedExtensions$);
  const value = useStateObservable(selectedValue$);
  const selectedSigner = useStateObservable(selectedSigner$);

  return (
    <div className="p-2 space-y-2">
      <div>
        <div className="text-muted-foreground text-sm">Select extension</div>
        {availableExtensions.length ? (
          <ul className="flex items-center flex-wrap gap-2">
            {availableExtensions.map((ext) => (
              <li key={ext}>
                <label className="py-1 px-2 border rounded flex items-center gap-1">
                  <input
                    type="checkbox"
                    value={ext}
                    checked={selectedExtensions.has(ext)}
                    onChange={(evt) => onToggleExtension(evt.target.value)}
                  />
                  {ext}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted-foreground">
            No Polkadot extensions available
          </div>
        )}
      </div>
      <div>
        <div className="text-muted-foreground text-sm">Select account</div>
        <AccountPicker value={value} selectValue={selectValue} />{" "}
      </div>
      {value ? (
        selectedSigner ? (
          <div>
            <CircleCheck className="inline-block text-green-600" size={20} />{" "}
            The account is one of the members of the multisig
          </div>
        ) : (
          <div className="text-orange-600">
            <TriangleAlert className="inline-block align-baseline" size={20} />{" "}
            The selected account doesn't look like one of the signatories of the
            selected multisig
          </div>
        )
      ) : null}
    </div>
  );
};
