import { startFromWorker } from "polkadot-api/smoldot/from-worker";
import SmWorker from "polkadot-api/smoldot/worker?worker";

export const smoldot = startFromWorker(new SmWorker(), {
  logCallback: (level, target, message) => {
    console.debug("smoldot[%s(%s)] %s", target, level, message);
  },
  forbidWs: true,
});

export const smoldotChains: Record<
  string,
  {
    relay: () => Promise<{ chainSpec: string }>;
    parachains?: Record<string, () => Promise<{ chainSpec: string }>>;
  }
> = {
  polkadot: {
    relay: () => import("polkadot-api/chains/polkadot"),
  },
  kusama: {
    relay: () => import("polkadot-api/chains/ksmcc3"),
    parachains: {
      kusamaAh: () => import("polkadot-api/chains/ksmcc3_asset_hub"),
    },
  },
};
