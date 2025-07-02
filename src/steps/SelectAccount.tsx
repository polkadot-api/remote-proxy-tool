import { AccountPicker } from "@/components/AccountSelector";
import {
  availableExtensions$,
  extensionAccounts$,
  onToggleExtension,
  selectedExtensions$,
} from "@/components/AccountSelector/accounts.state";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { map, of, switchMap } from "rxjs";
import { proxySigners$ } from "./SelectProxy";

const [valueSelectedChange$, selectValue] = createSignal<string>();
const selectedValue$ = state(valueSelectedChange$, null);

export const selectedAccount$ = selectedValue$.pipeState(
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

export const SelectAccount = () => {
  const availableExtensions = useStateObservable(availableExtensions$);
  const selectedExtensions = useStateObservable(selectedExtensions$);
  const value = useStateObservable(selectedValue$);
  const proxySigners = useStateObservable(proxySigners$);

  const allowedAddresses = proxySigners?.map((v) => v.address) ?? [];

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
        <AccountPicker
          value={value}
          selectValue={selectValue}
          allowedAddresses={allowedAddresses}
        />{" "}
      </div>
    </div>
  );
};
