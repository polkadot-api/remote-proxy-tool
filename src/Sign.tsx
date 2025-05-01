import { useStateObservable } from "@react-rxjs/core";
import { Dot, PenTool } from "lucide-react";
import { OnChainIdentity } from "./components/AccountSelector/OnChainIdentity";
import { Step } from "./components/Step";
import { Textarea } from "./components/ui/textarea";
import { stringify } from "./lib/json";
import { genericSS58 } from "./lib/ss58";
import { cn } from "./lib/utils";
import { decodedCallData$ } from "./steps/CallData";
import { SelectAccount } from "./steps/SelectAccount";
import { client$, selectedChain$ } from "./steps/SelectChain";
import { multisigAccount$, multisigCall$ } from "./steps/SelectMultisig";
import { Submit } from "./steps/Submit";

export const Sign = () => {
  const client = useStateObservable(client$);

  return (
    <div className="p-2 space-y-2">
      <div>
        <ChainStatus />
      </div>
      <div className={client ? "" : "opacity-50 pointer-events-none"}>
        <Step title="1. Select Account">
          <SelectAccount />
        </Step>
        <hr />
        <Step title="2. Submit">
          <Submit />
        </Step>
      </div>
    </div>
  );
};

const ChainStatus = () => {
  const chain = useStateObservable(selectedChain$);
  const client = useStateObservable(client$);
  const callData = useStateObservable(decodedCallData$);
  const multisig = useStateObservable(multisigAccount$)!;
  const multisigCall = useStateObservable(multisigCall$);

  const genericApprovals = multisigCall?.approvals.map(genericSS58) ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <div>Chain: {chain.value}</div>
        <Dot className={client ? "text-green-500" : "text-orange-300"} />
        <div>{client ? "Connected" : "Connecting…"}</div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span>Multisig:</span>
          <OnChainIdentity value={multisig.multisigId} />
        </div>
        <div>
          <p>Signatories:</p>
          <ul className="pl-1">
            {multisig.addresses.map((addr) => {
              const hasSigned = genericApprovals.includes(genericSS58(addr));
              return (
                <li key={addr} className="flex items-center gap-2">
                  <div
                    title={hasSigned ? "Approved" : "Pending"}
                    className="py-1 mt-1"
                  >
                    <PenTool
                      strokeWidth={1}
                      className={cn(
                        hasSigned
                          ? "text-green-600"
                          : "text-muted-foreground/50"
                      )}
                    />
                  </div>
                  <OnChainIdentity value={addr} />
                </li>
              );
            })}
          </ul>
        </div>
        <p>Threshold: {multisig.threshold}</p>
      </div>
      <div>
        {multisigCall ? (
          <div>
            This multisig call has already started,{" "}
            {multisigCall.approvals.length} out of {multisig.threshold}{" "}
            approvals so far.
          </div>
        ) : multisig.threshold === 1 ? (
          <div>
            Because this multisig has threshold 1, the call will be immediately
            executed with your signature.
          </div>
        ) : (
          <div>
            You will create this multisig call as it seems no one else from the
            group has started it yet.
          </div>
        )}
      </div>
      <div>
        <span>Call Data:</span>
        {callData ? (
          <Textarea
            className="border rounded font-mono p-2 text-sm text-foreground/80 max-h-96 overflow-auto"
            readOnly
          >
            {stringify(callData)}
          </Textarea>
        ) : (
          <span> Loading…</span>
        )}
      </div>
    </div>
  );
};
