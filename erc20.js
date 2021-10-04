'use strict';

const { Contract } = require('fabric-contract-api');

class erc20cc extends Contract {

    async mintTokens(ctx, amount) {
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'Org1MSP') throw new Error('You are not authorized to minting new tokens.');
        const amountInt = parseInt(amount);
        if (amountInt <= 0) throw new Error('Amount must be a positive integer.');

        const banker = ctx.clientIdentity.getID();
        const balanceKey = ctx.stub.createCompositeKey('balance', [banker]);
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

    async transferTokens(ctx, to, value) {
        const from = ctx.clientIdentity.getID();
        if (from === to) throw new Error('You cannot transfer tokens in same account.');

        const valueInt = parseInt(value);
        if (valueInt < 1) throw new Error('Amount should be more than 0.');

        const fromBalanceKey = ctx.stub.createCompositeKey('balance', [from]);
        const fromCurrentBalanceBytes = await ctx.stub.getState(fromBalanceKey);
        if (!fromCurrentBalanceBytes) throw new Error(`Your account has no balance.`);
        const fromCurrentBalance = parseInt(fromCurrentBalanceBytes.toString());
        if (fromCurrentBalance < valueInt) throw new Error(`Yuor account has insufficient funds.`);

        const toBalanceKey = ctx.stub.createCompositeKey('balance', [to]);
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

    async getMyClientID(ctx) {
        const clientID = ctx.clientIdentity.getID();
        return clientID;
    }

    async getMyBalance(ctx) {
        const clientID = ctx.clientIdentity.getID();
        const balanceKey = ctx.stub.createCompositeKey('balance', [clientID]);
        const balanceBytes = await ctx.stub.getState(balanceKey);
        if (!balanceBytes) throw new Error(`The account for ${clientID} does not exist.`);
        const balance = parseInt(balanceBytes.toString());
        return balance;
    }

}

module.exports = erc20cc;