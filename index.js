'use strict';

const erc20cc = require('./erc20.js');
const erc721cc = require('./erc721.js');
const marketplacecc = require('./marketplace.js');

module.exports.erc20cc = erc20cc;
module.exports.erc721cc = erc721cc;
module.exports.marketplacecc = marketplacecc;
module.exports.contracts = [erc20cc, erc721cc, marketplacecc];