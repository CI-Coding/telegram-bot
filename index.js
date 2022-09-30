require('dotenv').config()
// const express = require('express')
// const bodyParser = require('body-parser')
// const axios = require('axios')

const { telegramBotToken, SERVER_URL } = process.env

// New bot 
const TelegramBot = require('node-telegram-bot-api');
const cron = require("node-cron");
var etherscan = require('etherscan-api').init(process.env.ETHERSCAN_KEY);
console.log("etherscan: ", etherscan)

const options = {
    webHook: {
        port: process.env.PORT
    }
};

const Telegram_API = `https://api.telegram.org/bot${telegramBotToken}`
const URI = `/webhook/${telegramBotToken}`
const WEBHOOK_URL = SERVER_URL+URI

const bot = new TelegramBot(telegramBotToken, options);
const botOwner = process.env.BOTOWNER;

// Class to store addresses, previous balances and the Telegram chatID
class WatchEntry {
    constructor(chatID, ETHaddress, currentBalance, timeAddedToWatchlist) {
        this.chatID = chatID;
        this.ETHaddress = ETHaddress;
        this.currentBalance = currentBalance;
        this.timeAddedToWatchlist = timeAddedToWatchlist;
    }
}

// Array to store WatchEntry objects
var watchDB = [];

// *********************************
// Helper functions
// *********************************

// Function to check if an address is a valid Dracarys address
var isAddress = function (address) {
    address = address.toLowerCase();
    if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
        return false;
    } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
        return true;
    } else {
        return false;
    }
};

// *********************************
// Telegram bot event listeners
// *********************************

// Telegram error handling
bot.on('polling_error', (error) => {
    console.log(error.message);  // => 'EFATAL'
});

// Telegram checking for commands w/o parameters
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
});

// Telegram /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Hey there!\n\nI am here to watch Ethereum addresses. I will ping you if there's a change in balance. This is useful if you've just sent a transaction and want to be notified when it arrives. Due to API limitations, I can watch an address for no more than 24 hours.\n\n<b>Commands</b>\n\n <code>/watch (address)</code> - start watching an address.\n\n" ,{parse_mode : "HTML"});
});

// Telegram /watch command
bot.onText(/\/watch/, (msg, match) => {
    const chatId = msg.chat.id;
    const photo = `https://dracarys.finance/video/promo.mp4`;
    const ETHaddress = "0x657794245cda63990ef25a57c4838858ed6eb551";
    // const ETHaddress = "0xdb87df14ffd78b7859e18b33bc5de7c9ee8723ff";
    var blockNumber = etherscan.proxy.eth_blockNumber();
    // const supply = etherscan.stats.tokensupply(null, ETHaddress);
    // console.log('supply: ', supply)
    var balance = etherscan.account.tokenbalance('0x000000000000000000000000000000000000dead','',ETHaddress);
    balance.then(function(balanceData){
        var date = new Date();
        var timestamp = date.getTime();
        const newEntry = new WatchEntry(chatId, ETHaddress, balanceData.result, timestamp);
        watchDB.push(newEntry);
        var balanceToDisplay = balanceData.result / 1000000000000000000;
        balanceToDisplay = balanceToDisplay.toFixed(4);
        bot.sendVideo(chatId, photo, {
            caption: `Started watching the address ${ETHaddress}\nTotal Burnt ${balanceToDisplay} Dracarys.`,
            parse_mode : "HTML"
        });
    });
});

// Telegram /check command (not public)
bot.onText(/\/check/, (msg) => {
    // To manually trigger a check. For testing purposes.
    checkAllAddresses();
});


// *********************************
// Main functions
// *********************************

async function checkAllAddresses() {
    let counter = 1;
    if (counter == 1) {
        var debugNumberOfAlertsDelivered = 0;
        var newWatchDB = [];
        // using the for i structure because it's async
        for (var i = 0; i < watchDB.length; i++) {
            var entry = watchDB[i];
            // we check if the balance has changed
            const balance = await etherscan.account.tokenbalance('0x000000000000000000000000000000000000dead','',entry.ETHaddress);
            const tokensupply = await etherscan.stats.tokensupply(null, entry.ETHaddress);
            const fromatedTotalSupply = tokensupply.result /1e18;
            if (balance.result === entry.currentBalance) {
                // no transfer
            } else {
                // there was a transfer
                const media = `https://dracarys.finance/video/promo.mp4`;
                var difference = (balance.result - entry.currentBalance) / 1000000000000000000;
                difference = difference.toFixed(4);
                var balanceToDisplay = balance.result / 1000000000000000000;
                balanceToDisplay = balanceToDisplay.toFixed(4);
                
                let percentageBurnt = ( difference / fromatedTotalSupply ) * 100;
                percentageBurnt = percentageBurnt.toFixed(4);
 
                let totalPercentageBurnt = ( balanceToDisplay / fromatedTotalSupply ) * 100; 
                totalPercentageBurnt = totalPercentageBurnt.toFixed(4);

                let totalPercentageRemaining = (100 - totalPercentageBurnt);
                totalPercentageRemaining = totalPercentageRemaining.toFixed(4);


                let divident = difference / 100;
                let fireString = "🔥🔥";
                for (let i = 0; i < divident-1; i+=3) {
                    fireString+="🔥🔥";
                }
                if (difference > 0) {
                    //incoming transfer
                    bot.sendVideo(entry.chatID, media, {
                        caption: `${fireString}\n\n\n<b>Burnt Right Now:</b> ${difference}\n<b>Percentage Burnt: </b>${percentageBurnt}%\n-\n<b>Total Burnt:</b> ${balanceToDisplay}\n<b>Total Percentage Burnt: </b>${totalPercentageBurnt}%\n<b>Total Percentage Remaining: </b>${totalPercentageRemaining}%\n\n<a href="https://www.dextools.io/app/ether/pair-explorer/0x86c73cfc2673231b5326d9e38f018d9c0cffc639">Dextools</a> <a href="https://app.uniswap.org/#/swap?outputCurrency=0x657794245cda63990ef25a57c4838858ed6eb551&chain=mainnet">Uniswap</a> <a href="https://t.me/Dracarysjoin">Telegram</a>\n\n<b>We are the first burn bot that projects can use for free</b>`,
                        parse_mode : "HTML"
                    });
                } else {
                    //outgoing transfer
                    bot.sendVideo(entry.chatID, media, {
                        caption: `${fireString}\n\n\n<b>Burnt Right Now:</b> ${difference}\n<b>Percentage Burnt: </b>${percentageBurnt}%\n-\n<b>Total Burnt:</b> ${balanceToDisplay}\n<b>Total Percentage Burnt: </b>${totalPercentageBurnt}%\n<b>Total Percentage Remaining: </b>${totalPercentageRemaining}%\n\n<a href="https://www.dextools.io/app/ether/pair-explorer/0x86c73cfc2673231b5326d9e38f018d9c0cffc639">Dextools</a> <a href="https://app.uniswap.org/#/swap?outputCurrency=0x657794245cda63990ef25a57c4838858ed6eb551&chain=mainnet">Uniswap</a> <a href="https://t.me/Dracarysjoin">Telegram</a>\n\n<b>We are the first burn bot that projects can use for free</b>`,
                        parse_mode : "HTML"
                    });
                }
                // debug
                debugNumberOfAlertsDelivered = debugNumberOfAlertsDelivered + 1;
            }
            // if the entry is too old, we get rid of it
            var date = new Date();
            var now = date.getTime();
            if ((entry.timeAddedToWatchlist + (24*60000*60)) > now) {
                //has been added less than 24h ago
                const newEntry = new WatchEntry(entry.chatID, entry.ETHaddress, balance.result, entry.timeAddedToWatchlist);
                newWatchDB.push(newEntry);
            } else {
                bot.sendMessage(entry.chatID, `Due to API limitations, I can only watch an address for 24 hours.\n\nYou asked me to watch ${entry.ETHaddress} quite some time ago, so I dropped it from my list. Sorry about it!`);
            }
        }
        watchDB = newWatchDB;
        // Debug admin message for the bot owner
        if (debugNumberOfAlertsDelivered > 0) {
            debugNumberOfAlertsDelivered = 0;
        }
    }
    counter++;
}

function watch() {
    // do the scan every minute
    cron.schedule('*/1 * * * *', () => {
        checkAllAddresses();
    });
}

bot.setWebHook(`${SERVER_URL}/bot${telegramBotToken}`);
// kick it off
watch();



