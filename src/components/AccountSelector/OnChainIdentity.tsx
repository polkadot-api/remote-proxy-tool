import { cn } from "@/lib/utils";
import { client$ } from "@/steps/SelectChain";
import { dot } from "@polkadot-api/descriptors";
import { useStateObservable, withDefault } from "@react-rxjs/core";
import { AccountId, getSs58AddressInfo, SS58String } from "polkadot-api";
import { FC } from "react";
import { of, switchMap } from "rxjs";
import { CopyText } from "../CopyText";
import { PolkadotIdenticon } from "../PolkadotIdenticon";

const format$ = client$.pipeState(
  switchMap((client) =>
    client
      ? client.getUnsafeApi<typeof dot>().constants.System.SS58Prefix()
      : of(undefined)
  ),
  withDefault(undefined)
);

export const OnChainIdentity: FC<{
  value: SS58String;
  name?: string;
  className?: string;
  copyable?: boolean;
}> = ({ value, name, className, copyable = true }) => {
  const format = useStateObservable(format$);
  const pk = getPublicKey(value);
  const valueFormatted = pk ? AccountId(format).dec(pk) : value;
  console.log(valueFormatted.length);

  const identicon = (
    <PolkadotIdenticon className="flex-shrink-0" publicKey={pk} size={28} />
  );
  return (
    <div className={cn("flex items-center gap-1 overflow-hidden", className)}>
      {copyable ? (
        <CopyText
          text={valueFormatted}
          className="w-7 h-7 flex justify-center items-center"
        >
          {identicon}
        </CopyText>
      ) : (
        identicon
      )}
      <div className="flex flex-col justify-center text-foreground leading-tight overflow-hidden">
        {name && <span className="inline-flex items-center gap-1">{name}</span>}
        <span className="text-foreground/70 text-ellipsis overflow-hidden">
          {sliceMiddleAddr(valueFormatted)}
        </span>
      </div>
    </div>
  );
};

const getPublicKey = (address: string) => {
  const info = getSs58AddressInfo(address);
  return info.isValid ? info.publicKey : null;
};

const sliceMiddleAddr = (s: string) => s.slice(0, 10) + "…" + s.slice(-10);
