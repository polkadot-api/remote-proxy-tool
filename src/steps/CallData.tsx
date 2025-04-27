import { Textarea } from "@/components/ui/textarea";
import { getHashParam, setHashParam } from "@/lib/hashParams";
import { stringify } from "@/lib/json";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { ExternalLink } from "lucide-react";
import { Binary } from "polkadot-api";
import {
  catchError,
  combineLatest,
  defer,
  map,
  of,
  switchMap,
  tap,
} from "rxjs";
import { client$ } from "./SelectChain";

const [callDataChange$, setCallData] = createSignal<string>();
const rawCallData$ = state(
  callDataChange$.pipe(tap((v) => setHashParam("calldata", v))),
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

const decodedCallData$ = tx$.pipeState(
  map((v) => (v ? v.decodedCall : null)),
  withDefault(null)
);

export const CallData = () => {
  const rawCallData = useStateObservable(rawCallData$);
  const decodedCallData = useStateObservable(decodedCallData$);

  const hasPossibleError =
    rawCallData.length > 0 && rawCallData != "0x" && !decodedCallData;

  return (
    <div className="space-y-2 p-2">
      <Textarea
        className={
          hasPossibleError
            ? "border-orange-400 focus-visible:border-orange-400 focus-visible:ring-orange-400/50"
            : ""
        }
        placeholder="Enter hex-encoded call data"
        value={rawCallData}
        onChange={(evt) => setCallData(evt.target.value)}
      />
      <div>
        Tip: Use
        <a
          className="underline mx-1"
          href="https://dev.papi.how/extrinsics"
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
        <div className="border rounded font-mono p-2 text-sm text-foreground/80 max-h-64 overflow-auto">
          <pre>{stringify(decodedCallData)}</pre>
        </div>
      ) : null}
    </div>
  );
};
