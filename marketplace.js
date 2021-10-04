'use strict';

const { Contract } = require('fabric-contract-api');


class marketplacecc extends Contract {

    // to mint tokens, only minter can mint new tokens
    async mintTokens(ctx, amount) {
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'Org1MSP') throw new Error('You are not authorized to minting new tokens.');
        const amountInt = parseInt(amount);
        if (amountInt <= 0) throw new Error('Amount must be a positive integer.');

        const banker = ctx.clientIdentity.getID();
        const balanceKey = ctx.stub.createCompositeKey('tokenBalance', [banker]);
        const currentBalanceBytes = await ctx.stub.getState(balanceKey);
        let currentBalance;
        if (!currentBalanceBytes) currentBalance = 0;
        else currentBalance = parseInt(currentBalanceBytes.toString());
        const updatedBalance = currentBalance + amountInt;
        await ctx.stub.putState(balanceKey, Buffer.from(updatedBalance.toString()));

        const event = { from: '0x0', to: banker, value: amountInt };
        ctx.stub.setEvent('Minting', Buffer.from(JSON.stringify(event)));
        console.log(`Your account balance has been updated to ${updatedBalance}.`);
        return true;
    }

    // to mint new NFTs. NFT owners will ask minter to mint a new NFT from them for a defined fee
    async mintNFT(ctx, seller, nftID, tokenURI, price, fee) {
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'Org1MSP') throw new Error('You are not authorized to mint new tokens.');
        const minter = ctx.clientIdentity.getID();
        const feeInt = parseInt(fee);
        if (feeInt <= 0) throw new Error('Fee must be a positive integer.');

        const feeResponse  = await this.chargeFee(ctx, seller, fee)
        if(!feeResponse) throw new Error('Unable to deduct fee.')

        const nftKey = ctx.stub.createCompositeKey('nft', [nftID]);
        const nftBytes = await ctx.stub.getState(nftKey);
        if (nftBytes) throw new Error(`The token ${nftID} is already minted.`);
        const nftIdInt = parseInt(nftID);
        if (isNaN(nftIdInt)) throw new Error(`The nftID ${nftID} is invalid. Please provide an integer value.`);
        const priceInt = parseInt(price);
        if (isNaN(priceInt)) throw new Error(`The price ${price} is invalid. Please provide an integer value.`);

        const nft = {
            nftID: nftIdInt,
            owner: seller,
            price: priceInt,
            tokenURI: tokenURI
        };
        const nftKey = ctx.stub.createCompositeKey('nft', [nftID]);
        await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));
        const balanceKey = ctx.stub.createCompositeKey('nftBalance', [seller, nftID]);
        await ctx.stub.putState(balanceKey, Buffer.from('\u0000'));

        const event = { from: '0x0', to: minter, nftID: nftIdInt };
        ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(event)));
        return nft;
    }

    //to transfer tokens b/w two accounts. Minters will transfer the tokens to other account as per the rate. Everyone can use this function.
    async transferTokens(ctx, to, value) {
        const from = ctx.clientIdentity.getID();
        if (from === to) throw new Error('You cannot transfer tokens in same account.');

        const valueInt = parseInt(value);
        if (valueInt < 1) throw new Error('Amount should be more than 0.');

        const fromBalanceKey = ctx.stub.createCompositeKey('tokenBalance', [from]);
        const fromCurrentBalanceBytes = await ctx.stub.getState(fromBalanceKey);
        if (!fromCurrentBalanceBytes) throw new Error(`Your account has no balance.`);
        const fromCurrentBalance = parseInt(fromCurrentBalanceBytes.toString());
        if (fromCurrentBalance < valueInt) throw new Error(`Yuor account has insufficient funds.`);

        const toBalanceKey = ctx.stub.createCompositeKey('tokenBalance', [to]);
        const toCurrentBalanceBytes = await ctx.stub.getState(toBalanceKey);
        let toCurrentBalance;
        if (!toCurrentBalanceBytes) toCurrentBalance = 0;
        else toCurrentBalance = parseInt(toCurrentBalanceBytes.toString());

        const fromUpdatedBalance = fromCurrentBalance - valueInt;
        const toUpdatedBalance = toCurrentBalance + valueInt;
        await ctx.stub.putState(fromBalanceKey, Buffer.from(fromUpdatedBalance.toString()));
        await ctx.stub.putState(toBalanceKey, Buffer.from(toUpdatedBalance.toString()));
        console.log(`You have transfered ${value} from your account.`);

        const event = { from: from, to: to, value: parseInt(value) };
        ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(event)));
        return true;
    }

    //to charge minting fee from NFT owner
    async chargeFee(ctx, owner, fee) {
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'Org1MSP') throw new Error('You are not authorized to use this function.');
        const feeInt = parseInt(fee);
        if (feeInt <= 0) throw new Error('Fee must be a positive integer.');

        const minter = ctx.clientIdentity.getID();

        const ownerBalanceKey = ctx.stub.createCompositeKey('tokenBalance', [owner]);
        const ownerCurrentBalanceBytes = await ctx.stub.getState(ownerBalanceKey);
        if (!ownerCurrentBalanceBytes) throw new Error(`Owner's account have zero balance.`);
        const ownerCurrentBalance = parseInt(ownerCurrentBalanceBytes.toString());
        if (ownerCurrentBalance < fee) throw new Error(`Owner's account has insufficient funds.`);

        const minterBalanceKey = ctx.stub.createCompositeKey('tokenBalance', [minter]);
        const minterCurrentBalanceBytes = await ctx.stub.getState(minterBalanceKey);
        const minterCurrentBalance = parseInt(minterCurrentBalanceBytes.toString());

        const ownerUpdatedBalance = ownerCurrentBalance - fee;
        const minterUpdatedBalance = minterCurrentBalance + fee;
        await ctx.stub.putState(buyerBalanceKey, Buffer.from(ownerUpdatedBalance.toString()));
        await ctx.stub.putState(sellerBalanceKey, Buffer.from(minterUpdatedBalance.toString()));
        console.log(`Minting fee of ${fee} has been charged.`);

        const tokenEvent = { from: owner, to: minter, value: parseInt(price.toString()) };
        ctx.stub.setEvent('Token transfer', Buffer.from(JSON.stringify(tokenEvent)));

        return true;
    }

    //to buy an NFT using its nftID
    async buyNFT(ctx, nftID) {
        const buyer = ctx.clientIdentity.getID();
        const nft = await this.getNFTbyID(ctx, nftID);
        const owner = nft.owner;
        const price = nft.price;
        if (buyer === owner) throw new Error('You cannot buy your own NFT.');

        const buyerBalanceKey = ctx.stub.createCompositeKey('tokenBalance', [buyer]);
        const buyerCurrentBalanceBytes = await ctx.stub.getState(buyerBalanceKey);
        if (!buyerCurrentBalanceBytes) throw new Error(`Your account has no balance.`);
        const buyerCurrentBalance = parseInt(buyerCurrentBalanceBytes.toString());
        if (buyerCurrentBalance < price) throw new Error(`Yuor account has insufficient funds.`);

        const sellerBalanceKey = ctx.stub.createCompositeKey('tokenBalance', [owner]);
        const sellerCurrentBalanceBytes = await ctx.stub.getState(sellerBalanceKey);
        const sellerCurrentBalance = parseInt(sellerCurrentBalanceBytes.toString());

        const buyerUpdatedBalance = buyerCurrentBalance - price;
        const sellerUpdatedBalance = sellerCurrentBalance + price;
        await ctx.stub.putState(buyerBalanceKey, Buffer.from(buyerUpdatedBalance.toString()));
        await ctx.stub.putState(sellerBalanceKey, Buffer.from(sellerUpdatedBalance.toString()));
        console.log(`You have transfered ${price} from your account.`);

        const tokenEvent = { from: buyer, to: owner, value: parseInt(price.toString()) };
        ctx.stub.setEvent('Token transfer', Buffer.from(JSON.stringify(tokenEvent)));

        nft.owner = buyer;
        const nftKey = ctx.stub.createCompositeKey('nft', [nftID]);
        await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

        const sellerBalanceKey = ctx.stub.createCompositeKey('nftBalance', [owner, nftID]);
        await ctx.stub.deleteState(sellerBalanceKey);
        const buyerBalanceKey = ctx.stub.createCompositeKey('nftBalance', [buyer, nftID]);
        await ctx.stub.putState(buyerBalanceKey, Buffer.from('\u0000'));

        const nftIdInt = parseInt(nftID);
        const nftEvent = { from: owner, to: buyer, nftID: nftIdInt };
        ctx.stub.setEvent('NFT Transfer', Buffer.from(JSON.stringify(nftEvent)));
        return true;
    }

    //to get NFT details from its nftID
    async getNFTbyID(ctx, nftID) {
        const nftKey = ctx.stub.createCompositeKey('nft', [nftID]);
        const nftBytes = await ctx.stub.getState(nftKey);
        if (!nftBytes) throw new Error(`The nftID ${nftID} is invalid.`);
        const nft = JSON.parse(nftBytes.toString());
        return nft;
    }

    //to get NFT URI from its nftID
    async getTokenURI(ctx, nftID) {
        const nft = await this.getNFTbyID(ctx, nftID);
        return nft.tokenURI;
    }

    //to get client id
    async getMyClientID(ctx) {
        const clientID = ctx.clientIdentity.getID();
        return clientID;
    }

    //to get NFT balance
    async getMyNFTBalance(ctx) {
        const clientID = ctx.clientIdentity.getID();
        const iterator = await ctx.stub.getStateByPartialCompositeKey('nftBalance', [clientID]);
        let balance = 0;
        let result = await iterator.next();
        while (!result.done) {
            balance++;
            result = await iterator.next();
        }
        return balance;
    }

    //to get token balance
    async getMyTokenBalance(ctx) {
        const clientID = ctx.clientIdentity.getID();
        const balanceKey = ctx.stub.createCompositeKey('tokenBalance', [clientID]);
        const balanceBytes = await ctx.stub.getState(balanceKey);
        if (!balanceBytes) throw new Error(`The account for ${clientID} does not exist.`);
        const balance = parseInt(balanceBytes.toString());
        return balance;
    }

}

module.exports = marketplacecc;