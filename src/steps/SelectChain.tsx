import { Input } from "@/components/ui/input";
import { getHashParam } from "@/lib/hashParams";
import { smoldot, smoldotChains } from "@/smoldot";
import { getRemoteProxySdk } from "@polkadot-api/sdk-remote-proxy";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { Dot } from "lucide-react";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getSmProvider } from "polkadot-api/sm-provider";
import { getWsProvider, JsonRpcProvider } from "polkadot-api/ws-provider/web";
import {
  combineLatest,
  concat,
  finalize,
  map,
  NEVER,
  startWith,
  switchMap,
} from "rxjs";

interface SelectedChain {
  type: "sm" | "ws";
  relay: string;
  para: string;
}

const [selectedChainChange$, setSelectedChain] = createSignal<SelectedChain>();

const initialType = getHashParam("type");
const initialRelay = getHashParam("relay");
const initialPara = getHashParam("para");
export const initialHasChain = !!initialType && !!initialRelay && !!initialPara;

const initialChain: SelectedChain = {
  type: "sm",
  relay: "kusama",
  para: "kusamaAh",
};
initialChain.type = (initialType as "sm" | "ws") ?? initialChain.type;
initialChain.relay = (initialRelay as "sm" | "ws") ?? initialChain.relay;
initialChain.para = (initialPara as "sm" | "ws") ?? initialChain.para;

export const selectedChain$ = state<SelectedChain>(
  selectedChainChange$,
  initialChain
);

const getProvider = (
  selectedChain: SelectedChain
): {
  relay: JsonRpcProvider;
  para: JsonRpcProvider;
} => {
  if (selectedChain.type === "ws") {
    return {
      relay: withPolkadotSdkCompat(getWsProvider(selectedChain.relay)),
      para: withPolkadotSdkCompat(getWsProvider(selectedChain.para)),
    };
  }

  const relayChain = smoldotChains[selectedChain.relay]
    .relay()
    .then(({ chainSpec }) =>
      smoldot.addChain({
        chainSpec,
      })
    );
  const paraChainSpec = smoldotChains[selectedChain.relay].parachains?.[
    selectedChain.para
  ]?.().then((v) => v.chainSpec);
  const paraChain = Promise.all([relayChain, paraChainSpec]).then(
    ([relay, chainSpec]) => {
      if (!chainSpec)
        throw new Error(
          `Couldn't load chainSpec ${selectedChain.relay}:${selectedChain.para}`
        );
      return smoldot.addChain({
        chainSpec,
        potentialRelayChains: [relay],
      });
    }
  );

  return {
    relay: getSmProvider(relayChain),
    para: getSmProvider(paraChain),
  };
};

export const clients$ = state(
  selectedChain$.pipe(
    switchMap((selectedChain) => {
      const { relay, para } = getProvider(selectedChain);

      const relayClient = createClient(relay);
      const paraClient = createClient(para);

      const clients$ = combineLatest([
        relayClient.getUnsafeApi().runtimeToken,
        paraClient.getUnsafeApi().runtimeToken,
      ]).pipe(
        map(() => ({
          relayClient,
          paraClient,
          sdk: getRemoteProxySdk(relayClient, paraClient),
        })),
        startWith(null)
      );
      return concat(clients$, NEVER).pipe(
        finalize(() =>
          setTimeout(() => {
            relayClient.destroy();
            paraClient.destroy();
          })
        )
      );
    })
  ),
  null
);

export const client$ = clients$.pipeState(
  map((clients) => clients?.paraClient ?? null),
  withDefault(null)
);

export const SelectChain = () => {
  const selectedChain = useStateObservable(selectedChain$);
  const client = useStateObservable(client$);

  return (
    <div className="p-2">
      <ul className="flex gap-4 flex-wrap">
        {Object.keys(smoldotChains)
          .filter(
            (chain) =>
              Object.keys(smoldotChains[chain].parachains ?? {}).length > 0
          )
          .map((chain) => (
            <li key={chain}>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={selectedChain.relay === chain}
                  onChange={() =>
                    setSelectedChain({
                      ...selectedChain,
                      type: "sm",
                      relay: chain,
                      para:
                        selectedChain.para in smoldotChains[chain].parachains!
                          ? selectedChain.para
                          : Object.keys(smoldotChains[chain].parachains!)[0],
                    })
                  }
                />
                <div className="py-1 capitalize">{chain}</div>
              </label>
            </li>
          ))}
      </ul>
      {selectedChain.type === "sm" &&
      smoldotChains[selectedChain.relay]?.parachains ? (
        <ul className="flex gap-4 flex-wrap">
          {Object.keys(smoldotChains[selectedChain.relay].parachains!).map(
            (chain) => (
              <li key={chain}>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={selectedChain.para === chain}
                    onChange={() =>
                      setSelectedChain({
                        ...selectedChain,
                        type: "sm",
                        para: chain,
                      })
                    }
                  />
                  <div className="py-1 capitalize">{chain}</div>
                </label>
              </li>
            )
          )}
        </ul>
      ) : null}
      <label className="flex items-center gap-2">
        <input
          type="radio"
          checked={selectedChain.type === "ws"}
          onChange={() =>
            setSelectedChain({
              ...selectedChain,
              type: "ws",
            })
          }
        />
        <Input
          type="text"
          placeholder="RPC Relay URL"
          value={selectedChain.type === "ws" ? selectedChain.relay : ""}
          onChange={(evt) =>
            setSelectedChain({
              ...selectedChain,
              type: "ws",
              relay: evt.currentTarget.value,
            })
          }
        />
        <Input
          type="text"
          placeholder="RPC Parachain URL"
          value={selectedChain.type === "ws" ? selectedChain.para : ""}
          onChange={(evt) =>
            setSelectedChain({
              ...selectedChain,
              type: "ws",
              para: evt.currentTarget.value,
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
