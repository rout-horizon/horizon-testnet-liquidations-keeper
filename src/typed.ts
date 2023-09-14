import { ethers } from 'ethers';

export enum PerpsEvent {
  // PositionModified = 'PositionModified',
  // PositionLiquidated = 'PositionLiquidated',
  // FundingRecomputed = 'FundingRecomputed',
  // DelayedOrderSubmitted = 'DelayedOrderSubmitted',
  // DelayedOrderRemoved = 'DelayedOrderRemoved',
  AccountFlaggedForLiquidation = 'AccountFlaggedForLiquidation',
  AccountRemovedFromLiquidation = 'AccountRemovedFromLiquidation',
}

// event AccountFlaggedForLiquidation(address indexed account, uint deadline);
//     event AccountRemovedFromLiquidation(address indexed account, uint time);

export interface LiquidatingPosition {
    // event: string;
  account: string;
  executionFailures: number; // Number of times this has failed to execute
}

export interface Position {
  id: string;
  event: string;
  account: string;
  size: number;
  leverage: number;
  liqPrice: number;
  liqPriceUpdatedTimestamp: number;
}

export enum Network {
  OPT = 'mainnet', // 'optimism',
  OPT_GOERLI = 'testnet', // 'optimism-goerli',
}

export enum SubgraphEndPoint {
  MAINNET = 'https://thegraph.com/hosted-service/subgraph/rout-horizon/bsc-issuance',
  TESTNET = 'https://thegraph.com/hosted-service/subgraph/rout-horizon/new-chapel-issuance1',
}
