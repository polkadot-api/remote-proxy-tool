import { state } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { initialHasCallData } from "./steps/CallData";
import { initialHasChain } from "./steps/SelectChain";
import { initialHasMultisig } from "./steps/SelectMultisig";

export const [modeChange$, setMode] = createSignal<"edit" | "submit">();
const initialMode =
  initialHasChain && initialHasCallData && initialHasMultisig
    ? ("submit" as const)
    : ("edit" as const);

export const mode$ = state(modeChange$, initialMode);
