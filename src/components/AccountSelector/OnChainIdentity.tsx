import { cn } from "@/lib/utils";
import { getSs58AddressInfo, SS58String } from "polkadot-api";
import { FC } from "react";
import { CopyText } from "../CopyText";
import { PolkadotIdenticon } from "../PolkadotIdenticon";

export const OnChainIdentity: FC<{
  value: SS58String;
  name?: string;
  className?: string;
  copyable?: boolean;
}> = ({ value, name, className, copyable = true }) => {
  const identicon = (
    <PolkadotIdenticon
      className="flex-shrink-0"
      publicKey={getPublicKey(value)}
      size={28}
    />
  );
  return (
    <div className={cn("flex items-center gap-1 overflow-hidden", className)}>
      {copyable ? (
        <CopyText
          text={value}
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
          {value.slice(0, 16) + "…"}
        </span>
      </div>
    </div>
  );
};

const getPublicKey = (address: string) => {
  const info = getSs58AddressInfo(address);
  return info.isValid ? info.publicKey : null;
};
