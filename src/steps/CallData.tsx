import { Textarea } from "@/components/ui/textarea";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { ExternalLink } from "lucide-react";
import { catchError, combineLatest, defer, map, of, switchMap } from "rxjs";
import { client$ } from "./SelectChain";
import { Binary } from "polkadot-api";

const [callDataChange$, setCallData] = createSignal<string>();
const rawCallData$ = state(callDataChange$, "");

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
    <div className="space-y-2">
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
          <pre>
            {JSON.stringify(
              decodedCallData,
              (_, v) =>
                typeof v === "bigint"
                  ? `${v}n`
                  : v instanceof Binary
                  ? bytesToString(v)
                  : v,
              2
            )}
          </pre>
        </div>
      ) : null}
    </div>
  );
};

const textDecoder = new TextDecoder("utf-8", { fatal: true });
const bytesToString = (value: Binary) => {
  try {
    const bytes = value.asBytes();
    if (bytes.slice(0, 5).every((b) => b < 32)) throw null;
    return textDecoder.decode(bytes);
  } catch (_) {
    return value.asHex();
  }
};
