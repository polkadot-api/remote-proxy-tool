import { Textarea } from "@/components/ui/textarea";
import { getHashParam } from "@/lib/hashParams";
import { stringify } from "@/lib/json";
import { cn } from "@/lib/utils";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { ExternalLink } from "lucide-react";
import { Binary } from "polkadot-api";
import { catchError, combineLatest, defer, map, of, switchMap } from "rxjs";
import { client$, selectedChain$ } from "./SelectChain";

const [callDataChange$, setCallData] = createSignal<string>();
export const initialHasCallData = !!getHashParam("calldata");
export const rawCallData$ = state(
  callDataChange$,
  getHashParam("calldata") ?? ""
);

export const tx$ = state(
  combineLatest([client$, rawCallData$]).pipe(
    switchMap(([client, rawCallData]) => {
      if (!client) return of(null);

      return defer(() =>
        client.getUnsafeApi().txFromCallData(Binary.fromHex(rawCallData))
      ).pipe(
        catchError((err) => {
          console.error(err);
          return of(null);
        })
      );
    })
  ),
  null
);

export const decodedCallData$ = tx$.pipeState(
  map((v) => (v ? v.decodedCall : null)),
  withDefault(null)
);

const consoleChainParam$ = selectedChain$.pipeState(
  map((v) => {
    if (!v) return "";
    const params = new URLSearchParams();
    if (v.type === "ws") {
      params.set("networkId", "custom");
      params.set("endpoint", v.value);
    } else {
      params.set("endpoint", "light-client");
      params.set("networkId", v.value);
    }
    return `#` + params.toString();
  }),
  withDefault("")
);

export const CallData = () => {
  const rawCallData = useStateObservable(rawCallData$);
  const decodedCallData = useStateObservable(decodedCallData$);
  const consoleParams = useStateObservable(consoleChainParam$);

  const hasPossibleError =
    rawCallData.length > 0 && rawCallData != "0x" && !decodedCallData;

  return (
    <div className="space-y-2 p-2">
      <Textarea
        className={cn(
          "max-h-32",
          hasPossibleError
            ? "border-orange-400 focus-visible:border-orange-400 focus-visible:ring-orange-400/50"
            : ""
        )}
        placeholder="Enter hex-encoded call data"
        value={rawCallData}
        onChange={(evt) => setCallData(evt.target.value)}
      />
      <div>
        Tip: Use
        <a
          className="underline mx-1 inline-flex "
          href={"https://dev.papi.how/extrinsics" + consoleParams}
          target="_blank"
        >
          Papi console
          <ExternalLink
            className="inline-block align-baseline ml-1"
            size={16}
          />
        </a>
        to create your call data
      </div>
      {decodedCallData ? (
        <Textarea
          className="border rounded font-mono p-2 text-sm text-foreground/80 max-h-96 overflow-auto"
          readOnly
          value={stringify(decodedCallData)}
        />
      ) : null}
    </div>
  );
};
