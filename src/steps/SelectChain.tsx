import { Input } from "@/components/ui/input";
import { state, useStateObservable } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { Dot } from "lucide-react";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getSmProvider } from "polkadot-api/sm-provider";
import { startFromWorker } from "polkadot-api/smoldot/from-worker";
import SmWorker from "polkadot-api/smoldot/worker?worker";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { concat, finalize, from, map, NEVER, startWith, switchMap } from "rxjs";

const smoldot = startFromWorker(new SmWorker(), {
  logCallback: (level, target, message) => {
    console.debug("smoldot[%s(%s)] %s", target, level, message);
  },
  forbidWs: true,
});

const smoldotChains: Record<string, () => Promise<{ chainSpec: string }>> = {
  polkadot: async () => import("polkadot-api/chains/polkadot"),
  kusama: async () => import("polkadot-api/chains/ksmcc3"),
};

interface SelectedChain {
  type: "sm" | "ws";
  value: string;
}
const [selectedChainChange$, setSelectedChain] = createSignal<SelectedChain>();
const selectedChain$ = state<SelectedChain>(selectedChainChange$, {
  type: "sm",
  value: "polkadot",
});

const getProvider = (selectedChain: SelectedChain) => {
  if (selectedChain.type === "ws") {
    console.log("return ws");
    return withPolkadotSdkCompat(getWsProvider(selectedChain.value));
  }
  return getSmProvider(
    smoldotChains[selectedChain.value]().then(({ chainSpec }) =>
      smoldot.addChain({
        chainSpec,
      })
    )
  );
};

export const client$ = state(
  selectedChain$.pipe(
    switchMap((selectedChain) => {
      const provider = getProvider(selectedChain);
      console.log("create new client");
      const client = createClient(provider);

      const client$ = from(client.getUnsafeApi().runtimeToken).pipe(
        map(() => client),
        startWith(null)
      );
      return concat(client$, NEVER).pipe(
        finalize(() =>
          setTimeout(() => {
            client.destroy();
          })
        )
      );
    })
  ),
  null
);

export const SelectChain = () => {
  const selectedChain = useStateObservable(selectedChain$);
  const client = useStateObservable(client$);
  console.log("client", client);

  return (
    <div>
      <ul className="flex gap-4 flex-wrap">
        {Object.keys(smoldotChains).map((chain) => (
          <li key={chain}>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={selectedChain.value === chain}
                onChange={() =>
                  setSelectedChain({
                    type: "sm",
                    value: chain,
                  })
                }
              />
              <div className="py-1">{chain}</div>
            </label>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          checked={selectedChain.type === "ws"}
          onChange={() =>
            setSelectedChain({
              type: "ws",
              value: "",
            })
          }
        />
        <Input
          type="text"
          placeholder="RPC Endpoint URL"
          value={selectedChain.type === "ws" ? selectedChain.value : ""}
          onChange={(evt) =>
            setSelectedChain({
              type: "ws",
              value: evt.currentTarget.value,
            })
          }
        />
      </label>
      <div className="flex items-center mt-2 text-foreground/80">
        <div>Connection status:</div>
        <Dot className={client ? "text-green-500" : "text-orange-300"} />
        <div>{client ? "Connected" : "Connecting…"}</div>
      </div>
    </div>
  );
};
