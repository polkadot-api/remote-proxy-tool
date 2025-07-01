import { Subscribe, useStateObservable } from "@react-rxjs/core";
import { merge } from "rxjs";
import { Edit } from "./Edit";
import { Sign } from "./Sign";
import { mode$ } from "./mode";
import { decodedCallData$ } from "./steps/CallData";
import { selectedAccount$ } from "./steps/SelectAccount";
import { client$ } from "./steps/SelectChain";
import { multisigAccount$, proxyAddress$ } from "./steps/SelectProxy";

const app$ = merge(
  client$,
  decodedCallData$,
  multisigAccount$,
  proxyAddress$,
  selectedAccount$
);
function App() {
  const mode = useStateObservable(mode$);

  return (
    <Subscribe source$={app$}>
      <div className="p-2 max-w-2xl m-auto">
        {mode === "edit" ? <Edit /> : <Sign />}
      </div>
    </Subscribe>
  );
}

export default App;
