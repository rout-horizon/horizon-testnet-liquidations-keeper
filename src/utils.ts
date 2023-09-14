import { Contract, providers, Signer, utils } from 'ethers';
import { zipObject } from 'lodash';
import synthetix from '@rout-horizon/testnet-contracts';
import SynthetixJson from '../contracts/Synthetix.json';
import { createLogger } from './logging';
import { Network } from './typed';

const logger = createLogger('Utils');

interface KeeperContracts {
  horizon: Contract;
  liquidator: Contract;
  // exchangeRates: Contract;
  // marketManager: Contract;
  // marketSettings: Contract;
  // markets: Record<string, { contract: Contract; asset: string }>;
  // pyth: { priceFeedIds: Record<string, string>; endpoint: string; contract: Contract };
}

export const networkToSynthetixNetworkName = (network: Network): string => {
  switch (network) {
    case Network.OPT:
      return 'mainnet';
    case Network.OPT_GOERLI:
      return 'testnet';
    default:
      throw new Error(`Unsupported Synthetix Network Name Mapping '${network}'`);
  }
};

const getSynthetixContractByName = (
  name: string,
  network: Network,
  provider: providers.BaseProvider
): Contract => {

  // console.log("NOT GETTING ABI", name, network, provider);
  const snxNetwork = networkToSynthetixNetworkName(network);
  const abi = synthetix.getSource({ network: snxNetwork, contract: name }).abi;
  const address = synthetix.getTarget({ network: snxNetwork, contract: name }).address;

  logger.info(`Found ${name} contract at '${address}'`);
  return new Contract(address, abi, provider);
};

// Todo - Abi as synthetix contract but contract as proxySynthetix 
export const getRelevantContracts = async (
  network: Network,
  signer: Signer,
  provider: providers.BaseProvider
): Promise<KeeperContracts> => {
  // const proxysynthetix = getSynthetixContractByName('ProxySynthetix', network, provider);
  const proxysynthetixAddress = synthetix.getTarget({ network: network, contract: 'ProxySynthetix' }).address;

  // const proxyerc20 = getSynthetixContractByName('ProxyERC20', network, provider);
  const liquidator = getSynthetixContractByName('Liquidator', network, provider);

  const horizon = new Contract(proxysynthetixAddress, SynthetixJson.abi, signer);

  return { horizon, liquidator };
}

export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
