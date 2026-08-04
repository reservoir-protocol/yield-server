const sdk = require('@defillama/sdk');
const axios = require('axios');
const utils = require('../utils');

const project = 'agua';

// One entry per Agua carry vault. Each renders as its own pool in the Yields
// tab; add a new vault here and it shows up alongside the existing ones.
const vaults = [
  {
    chain: 'ethereum',
    address: '0xa98b4a70e17e55045cde4972b95bc2e8cec22a0f', // aguaUSDCgc - Agua Global Carry Vault
  },
];

const convertToAssetsAbi = {
  inputs: [{ internalType: 'uint256', name: 'shares', type: 'uint256' }],
  name: 'convertToAssets',
  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
};

const ONE_SHARE = '1000000000000000000'; // 1e18 shares
const WEEK = 7 * 86400;

const getPool = async ({ chain, address }) => {
  const asset = (
    await sdk.api.abi.call({ target: address, abi: 'address:asset', chain })
  ).output;
  const symbol = (
    await sdk.api.abi.call({ target: address, abi: 'erc20:symbol', chain })
  ).output;
  const assetDecimals = (
    await sdk.api.abi.call({ target: asset, abi: 'erc20:decimals', chain })
  ).output;
  const totalAssets = (
    await sdk.api.abi.call({ target: address, abi: 'uint256:totalAssets', chain })
  ).output;

  const priceKey = `${utils.formatChain(chain)}:${asset}`;
  const price = (
    await axios.get(`https://coins.llama.fi/prices/current/${priceKey}`)
  ).data.coins[priceKey]?.price;
  const tvlUsd = (totalAssets / 10 ** assetDecimals) * price;

  // apyBase from the 7-day change in price-per-share (convertToAssets(1 share)).
  const now = Math.floor(Date.now() / 1000);
  const [blockNow, blockWeekAgo] = await utils.getBlocksByTime(
    [now, now - WEEK],
    chain
  );
  let apyBase;
  try {
    const [ppsNow, ppsWeekAgo] = (
      await Promise.all(
        [blockNow, blockWeekAgo].map((block) =>
          sdk.api.abi.call({
            target: address,
            abi: convertToAssetsAbi,
            params: [ONE_SHARE],
            chain,
            block,
          })
        )
      )
    ).map((r) => r.output / 1e18);
    apyBase = ((ppsNow - ppsWeekAgo) / ppsWeekAgo) * (365 / 7) * 100;
  } catch (e) {
    // Vault younger than the lookback window (no share price 7 days ago).
    apyBase = 0;
  }

  return {
    pool: `${address}-${utils.formatChain(chain)}`,
    chain: utils.formatChain(chain),
    project,
    symbol,
    tvlUsd,
    apyBase: Number.isFinite(apyBase) && apyBase >= 0 ? apyBase : 0,
    underlyingTokens: [asset],
  };
};

const apy = async () => {
  const pools = await Promise.all(vaults.map(getPool));
  return pools.filter((p) => utils.keepFinite(p));
};

module.exports = {
  timetravel: false,
  apy,
  // TODO(agua): set to Agua's official site. yield-server's pool-link test uses
  // this as the fallback URL when a pool has no `url`, so it must be a real link.
  url: 'https://www.agua.finance/',
};
