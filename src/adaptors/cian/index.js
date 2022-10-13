const axios = require('axios');

const apiUrl_avax = 'https://data.cian.app/api/v1/staking_avax/apr';
const apiUrl_btc = 'https://data.cian.app/api/v1/staking_btc/apr';

async function fetch() {
  const response_avax = (await axios.get(apiUrl_avax)).data.data;
  const response_btc = (await axios.get(apiUrl_btc)).data.data;
  return [...response_avax, ...response_btc];
}

const main = async () => {
  const data = await fetch();

  return data.map((p) => {
    const symbol = p.symbol.split('-');
    return {
      ...p,
      symbol: symbol[1],
      poolMeta: symbol[2],
    };
  });
};

module.exports = {
  timetravel: false,
  apy: main,
  url: 'https://dapp.cian.app',
};
