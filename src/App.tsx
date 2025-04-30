import { Subscribe, useStateObservable } from "@react-rxjs/core";
import { merge } from "rxjs";
import { Edit } from "./Edit";
import { Sign } from "./Sign";
import { Button } from "./components/ui/button";
import { mode$, setMode } from "./mode";
import { decodedCallData$ } from "./steps/CallData";
import { client$ } from "./steps/SelectChain";
import { multisigAccount$ } from "./steps/SelectMultisig";

const app$ = merge(client$, decodedCallData$, multisigAccount$);
function App() {
  const mode = useStateObservable(mode$);

  return (
    <Subscribe source$={app$}>
      <div className="p-2 max-w-2xl m-auto">
        <div className="flex items-center justify-between border-b">
          <h1 className="font-bold text-2xl p-2">PAPI Multisig Tool</h1>
          {mode === "submit" ? (
            <Button onClick={() => setMode("edit")}>Edit</Button>
          ) : null}
        </div>
        {mode === "edit" ? <Edit /> : <Sign />}
      </div>
    </Subscribe>
  );
}

export default App;
