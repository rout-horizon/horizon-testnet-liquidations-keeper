import { Block } from '@ethersproject/abstract-provider';
import { BigNumber, Contract, Event, providers, utils } from 'ethers';
import { Keeper } from '.';
import { LiquidatingPosition, PerpsEvent } from '../typed';
import { chunk } from 'lodash';
import { Metric, Metrics } from '../metrics';
import { delay } from '../utils';
import { SignerPool } from '../signerpool';

export class StakingLiquidationKeeper extends Keeper {
  // The index
  private liquidatingPositions: Record<string, LiquidatingPosition> = {};
  
  readonly EVENTS_OF_INTEREST: PerpsEvent[] = [
    PerpsEvent.AccountFlaggedForLiquidation,
    PerpsEvent.AccountRemovedFromLiquidation,
  ];

  constructor(
    horizon: Contract,
    liquidator: Contract,
    signerPool: SignerPool,
    provider: providers.BaseProvider,
    metrics: Metrics,
    network: string,
    private readonly maxExecAttempts: number
  ) {
    super('StakingLiquidationKeeper', horizon, liquidator, signerPool, provider, metrics, network);
  }

  async updateIndex(events: Event[]): Promise<void> {
    if (!events.length) {
      return;
    }

    this.logger.info('Events available for index', { args: { n: events.length } });
    // const blockCache: Record<number, Block> = {};
    for (const evt of events) {
      const { event, args, blockNumber } = evt;
      if (!args) {
        return;
      }
      const { account } = args;
      switch (event) {
        case PerpsEvent.AccountFlaggedForLiquidation: {
          this.logger.info('Account flagged for liquidation. Adding to index!', {
            args: { account, blockNumber },
          });

          this.liquidatingPositions[account] = {
            account,
            executionFailures: 0,
          };
          break;
        }
        case PerpsEvent.AccountRemovedFromLiquidation: {
          this.logger.info('Account removed from liquidation. Removing from index', {
            args: { account, blockNumber },
          });
          delete this.liquidatingPositions[account];
          break;
        }
        default:
          this.logger.debug('No handler found for event', {
            args: { event, account, blockNumber },
          });
      }
    }
  }

  private async executeOrder(account: string): Promise<void> {
    // Cases:
    //
    // (A) Invokes execute
    //  - The order is ready to be executed and the market allows for it
    // (B) Invokes execute and fails after n attempts and discards
    //  - We think the order is ready to be executed but on-chain, it is not
    //  - The order missed execution window. It must be cancelled
    //  - The order missed execution window. Cancellation is failing (e.g. paused)
    //  - We think the order can be executed/cancelled but the order does not exist

    const order = this.liquidatingPositions[account];

    if (!order) {
      this.logger.info('Account does not have any tracked orders', { args: { account } });
      return;
    }

    if (order.executionFailures > this.maxExecAttempts) {
      this.logger.info('Liquidation execution exceeded max attempts', {
        args: { account, attempts: order.executionFailures },
      });
      order.executionFailures = 0;
      // delete this.liquidatingPositions[account];
      return;
    }

    // Todo - Put the liquidator contract here, selfLiquidation param is set false
    const canLiquidatePosition = await this.liquidator.isLiquidationOpen(account, false);
    if (!canLiquidatePosition) {
        return;
    }
    try {
      await this.signerPool.withSigner(
        // Todo - Why is asset required for a signer ?
        async signer => {
          this.logger.info('Executing liquidating position ...', { args: { account } });
          const tx = await this.horizon.connect(signer).liquidateDelinquentAccount(account);

          this.logger.info('Submitted transaction, waiting for completion...', {
            args: { account, nonce: tx.nonce },
          });
          await this.waitTx(tx);
          delete this.liquidatingPositions[account];
        },
        { asset: account }
      );
    //   todo - set metrics
      this.metrics.count(Metric.DELAYED_ORDER_EXECUTED, this.metricDimensions);
    } catch (err) {
      order.executionFailures += 1;
      this.metrics.count(Metric.KEEPER_ERROR, this.metricDimensions);
      this.logger.error('Liquidation failed', {
        args: { executionFailures: order.executionFailures, account: order.account, err },
      });
      this.logger.error((err as Error).stack);
    }
  }

  async execute(): Promise<void> {
    try {
      const orders = Object.values(this.liquidatingPositions);

      if (orders.length === 0) {
        this.logger.info('No orders available... skipping');
        return;
      }

      // Get the latest CL roundId.
    //   const currentRoundId = await this.exchangeRates.getCurrentRoundId(
    //     utils.formatBytes32String(this.baseAsset)
    //   );

      const block = await this.provider.getBlock(await this.provider.getBlockNumber());

    // Todo -   

    //   // Filter out orders that may be ready to execute.
    //   const executableOrders = orders.filter(
    //     ({ executableAtTime, targetRoundId }) =>
    //       currentRoundId.gte(targetRoundId) || BigNumber.from(block.timestamp).gte(executableAtTime)
    //   );

    //   // No orders. Move on.
    //   if (executableOrders.length === 0) {
    //     this.logger.info('No delayed orders ready... skipping');
    //     return;
    //   }

    //   this.logger.info(
    //     `Found ${executableOrders.length}/${orders.length} order(s) that can be executed`
    //   );
    
    // Todo - how  do we manage batch/chunks
      for (const batch of chunk(orders, this.MAX_BATCH_SIZE)) {
        this.logger.info(`Running keeper batch with '${batch.length}' orders(s) to keep`);
        const batches = batch.map(({ account }) =>
          this.execAsyncKeeperCallback(account, () => this.executeOrder(account))
        );
        await Promise.all(batches);
        await delay(this.BATCH_WAIT_TIME);
      }
    } catch (err) {
      this.logger.error('Failed to execute delayed order', { args: { err } });
      this.logger.error((err as Error).stack);
    }
  }
}
