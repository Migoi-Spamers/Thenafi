require('dotenv').config();

const fs = require('fs');
const axios = require("axios");
const {Web3} = require('web3');

const {
    BSC_RPC,
    YOUR_ADDRESS,
    PRIVATE_KEY,
    HOLDING_THE,
    SWAPPING_THE_TO_LIVETHE_RATE,
    SWAPPING_LIVETHE_TO_THE_RATE
} = process.env;

const theAddress = '0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11';
const liveTheAddress = '0xCdC3A010A3473c0C4b2cB03D8489D6BA387B83CD';

const theContractABI = require('./theABI.json');
const liveTheContractABI = require('./liveTheABI.json');
const contractABI = require('./liveThePoolABI.json');

const THE_NAME = 'THE';
const LIVETHE_NAME = 'LIVETHE';

const contractAddress = '0xd4ae6eCA985340Dd434D38F470aCCce4DC78D109';

const web3 = new Web3(BSC_RPC);

const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
web3.eth.defaultAccount = account.address;

const theContract = new web3.eth.Contract(theContractABI, theAddress);
const liveTheContract = new web3.eth.Contract(liveTheContractABI, liveTheAddress);

const contract = new web3.eth.Contract(contractABI, contractAddress);

let swapsToLiveThe = !!HOLDING_THE;

function getTokenPrices() {
    return new Promise((resolve, reject) => {
        axios.get("https://api.dexscreener.com/latest/dex/pairs/bsc/0x3765476BfFE43Cf4c0656bF3A7529c54ae247056").then((response) => {
            const priceNative = Number.parseFloat(response.data.pair.priceNative);

            console.log(`
                Date: ${Date()}
                Price native: ${priceNative}%
            `);

            const logData = {
                priceNative: priceNative
            };

            if (swapsToLiveThe) {
                if (priceNative <= Number.parseFloat(SWAPPING_THE_TO_LIVETHE_RATE)) {
                    swap(LIVETHE_NAME, resolve, reject, logData);
                } else {
                    console.log('dont buy');
                    resolve({bought: false});
                }
            } else {
                if (priceNative >= Number.parseFloat(SWAPPING_LIVETHE_TO_THE_RATE)) {
                    swap(THE_NAME, resolve, reject, logData);
                } else {
                    console.log('dont buy');
                    resolve({bought: false});
                }
            }
        }).catch((error) => {
            reject(error);
        });
    });
}

async function swap(swapTo, resolve, reject, logData) {
    try {
        console.log(`Swapping to ${swapTo}`);

        swapsToLiveThe = !swapsToLiveThe;

        const tokenContract = swapTo === LIVETHE_NAME ? theContract : liveTheContract;
        let amountIn = await tokenContract.methods.balanceOf(YOUR_ADDRESS).call();
        amountIn = Number.parseFloat(amountIn) / (10 ** 18);
        amountIn = Math.floor(amountIn) * (10 ** 18);

        const amountOutMin = amountIn * 0.9;

        await tokenContract.methods.approve(contractAddress, amountIn).send({
            from: YOUR_ADDRESS,
            gas: '70000', // Adjust gas limit as needed
            gasPrice: web3.utils.toWei('3', 'gwei'),
        });

        console.log(`Approved token`);
        console.log(amountIn, amountOutMin);

        const [fromToken, toToken] = swapTo === LIVETHE_NAME ? [theAddress, liveTheAddress] : [liveTheAddress, theAddress];

        const routes = [{
            from: fromToken,
            to: toToken,
            stable: true
        }];

        const deadline = Math.floor(Date.now() / 1000) + 60 * 2;
        contract.methods.swapExactTokensForTokens(JSON.stringify(amountIn), JSON.stringify(amountOutMin), routes, YOUR_ADDRESS, deadline)
            .send({
                from: YOUR_ADDRESS,
                gas: '400000', // Adjust gas limit as needed
                gasPrice: web3.utils.toWei('3', 'gwei'), // Set gas price
            })
            .then((result) => {
                console.log('Swap successful! txs: ', result.transactionHash);
                resolve({bought: true, logData: {txsHash: result.transactionHash, swapTo: swapTo, ...logData}});
            })
            .catch((error) => {
                reject(error);
            });
    } catch (error) {
        reject(error);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callToGetPrice() {
    while (true) {
        try {
            const data = await getTokenPrices();

            if (data.bought) {
                fs.appendFile('./logData.txt', `
                    Date: ${Date()}
                    priceNative: $${data.logData.priceNative}
                    SwapTo: ${data.logData.swapTo}
                    txs: https://bscscan.com/tx/${data.logData.txsHash}
                    ---------------------------
                `, function (err) {
                    if (err) throw err;
                    console.log('Updated LogData!');
                })
            }
            await sleep(60000 * 2);
        } catch (error) {
            console.error(error);
            break;
        }
    }
}

function main() {
    callToGetPrice();
}

// Check connection status
web3.eth.net.isListening()
    .then(() => {
        console.log('Connected to BSC');
        main();
    })
    .catch((error) => console.error('Connection error:', error));
