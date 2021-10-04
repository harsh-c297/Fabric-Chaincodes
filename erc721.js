'use strict';

const { Contract } = require('fabric-contract-api');

class erc721cc extends Contract {

    async getOwnerID(ctx, nftID) {
        const nft = await this.getNFTbyID(ctx, nftID);
        const owner = nft.owner;
        if (!owner) throw new Error('No owner is assigned to this token');
        return owner;
    }

    async transferNFT(ctx, to, nftID) {
        const from = ctx.clientIdentity.getID();
        const nft = await this.getNFTbyID(ctx, nftID);
        const owner = nft.owner;
        if (owner !== from) throw new Error('You are not the owner of this NFT.');
        if (owner === to) throw new Error('You cannot transfer to same account.');

        nft.owner = to;
        const nftKey = ctx.stub.createCompositeKey('nft', [nftID]);
        await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

        const fromBalanceKey = ctx.stub.createCompositeKey('balance', [from, nftID]);
        await ctx.stub.deleteState(fromBalanceKey);
        const toBalanceKey = ctx.stub.createCompositeKey('balance', [to, nftID]);
        await ctx.stub.putState(toBalanceKey, Buffer.from('\u0000'));

        const nftIdInt = parseInt(nftID);
        const event = { from: from, to: to, nftID: nftIdInt };
        ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(event)));
        return true;
    }

    async getTokenURI(ctx, nftID) {
        const nft = await this.getNFTbyID(ctx, nftID);
        return nft.tokenURI;
    }

    async getNFTbyID(ctx, nftID) {
        const nftKey = ctx.stub.createCompositeKey('nft', [nftID]);
        const nftBytes = await ctx.stub.getState(nftKey);
        if (!nftBytes) throw new Error(`The nftID ${nftID} is invalid.`);
        const nft = JSON.parse(nftBytes.toString());
        return nft;
    }

    async mintNFT(ctx, nftID, tokenURI) {
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'Org1MSP') throw new Error('You are not authorized to mint new tokens.');
        const minter = ctx.clientIdentity.getID();

        const nftKey = ctx.stub.createCompositeKey('nft', [nftID]);
        const nftBytes = await ctx.stub.getState(nftKey);
        if (nftBytes) throw new Error(`The token ${nftID} is already minted.`);
        const nftIdInt = parseInt(nftID);
        if (isNaN(nftIdInt)) throw new Error(`The nftID ${nftID} is invalid. Please provide an integer value.`);

        const nft = {
            nftID: nftIdInt,
            owner: minter,
            tokenURI: tokenURI
        };
        const nftKey = ctx.stub.createCompositeKey('nft', [nftID]);
        await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));
        const balanceKey = ctx.stub.createCompositeKey('balance', [minter, nftID]);
        await ctx.stub.putState(balanceKey, Buffer.from('\u0000'));

        const event = { from: '0x0', to: minter, nftID: nftIdInt };
        ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(event)));
        return nft;
    }

    async getMyBalance(ctx) {
        const clientID = ctx.clientIdentity.getID();
        const iterator = await ctx.stub.getStateByPartialCompositeKey('balance', [clientID]);
        let balance = 0;
        let result = await iterator.next();
        while (!result.done) {
            balance++;
            result = await iterator.next();
        }
        return balance;
    }

    async getMyClientID(ctx) {
        const clientID = ctx.clientIdentity.getID();
        return clientID;
    }
}

module.exports = erc721cc;