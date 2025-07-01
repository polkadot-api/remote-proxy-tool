import { Subscribe, useStateObservable } from "@react-rxjs/core";
import { merge } from "rxjs";
import { Edit } from "./Edit";
import { Sign } from "./Sign";
import { Button } from "./components/ui/button";
import { mode$, setMode } from "./mode";
import { decodedCallData$ } from "./steps/CallData";
import { client$ } from "./steps/SelectChain";

const app$ = merge(client$, decodedCallData$);
function App() {
  const mode = useStateObservable(mode$);

  return (
    <Subscribe source$={app$}>
      <div className="p-2 max-w-2xl m-auto">
        <div className="relative">
          <h1 className="text-center font-bold text-2xl p-2">
            PAPI Remote Proxy Tool
          </h1>
          {mode === "submit" ? (
            <Button
              className="absolute right-0 top-1/2 -translate-y-1/2"
              onClick={() => setMode("edit")}
            >
              Edit
            </Button>
          ) : null}
        </div>
        {mode === "edit" ? <Edit /> : <Sign />}
      </div>
    </Subscribe>
  );
}

export default App;
