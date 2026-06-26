import { TRADE_TRANSIT_ROUTES } from "../contexts/TradeTransitRequestContext";

export function newPipelinePath(fresh = true): string {
  return fresh
    ? `${TRADE_TRANSIT_ROUTES.newPipeline}?fresh=1`
    : TRADE_TRANSIT_ROUTES.newPipeline;
}
