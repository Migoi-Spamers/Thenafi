require('dotenv').config();

const fs = require('fs');
const axios = require("axios");
const {Web3} = require('web3');

const {
    BSC_RPC,
    IDEFINEKEY,
    YOUR_ADDRESS,
    PRIVATE_KEY,
    AMOUNT_IN,
    AMOUNT_OUT_MIN,
    SWAP_PERCENT,
} = process.env;

const TheAddress = '0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11';
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

const theContract = new web3.eth.Contract(theContractABI, TheAddress);
const liveTheContract = new web3.eth.Contract(liveTheContractABI, liveTheAddress);

const contract = new web3.eth.Contract(contractABI, contractAddress);

let swapsToLiveThe = true;

function getTokenPrices() {
    return new Promise((resolve, reject) => {
        axios.post("https://graph.defined.fi/graphql",
            {
                query: `
                {
                    getTokenPrices(
                      inputs: [
                        { address: "${TheAddress}", networkId: 56 }
                        { address: "${liveTheAddress}", networkId: 56 }
                      ]
                    ) {
                      address
                      networkId
                      priceUsd
                    }
                }
                `
            }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": IDEFINEKEY
            }
        }
        ).then((response) => {
            const [the, liveThe] = response.data.data.getTokenPrices;
            // const diffPercent = 100 - (liveThe.priceUsd / the.priceUsd) * 100;
            const diffPercent = Math.floor(Math.random() * 8);

            console.log(`
                Date: ${Date()}
                THE: $${the.priceUsd}
                LiveTHE: $${liveThe.priceUsd}
                LiveTHE/THE: ${diffPercent}%
            `);

            const logData = {
                thePrice: the.priceUsd, 
                livePrice: liveThe.priceUsd, 
                percent: diffPercent
            };

            if (swapsToLiveThe) {
                if (diffPercent >= Number.parseFloat(SWAP_PERCENT)) {
                    swap(LIVETHE_NAME, resolve, reject, logData);
                } else {
                    resolve({bought: false});
                }
            } else {
                if (diffPercent < 2) {
                    swap(THE_NAME, resolve, reject, logData);
                } else {
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
        amountIn = (Math.floor(amountIn * 100) / 100) * (10 ** 18);

        const amountOutMin = amountIn * 0.98;

        console.log(amountIn, amountOutMin);

        const routes = [{
            from: swapTo === LIVETHE_NAME ? TheAddress : liveTheAddress,
            to: swapTo === LIVETHE_NAME ? liveTheAddress : TheAddress,
            stable: true
        }];

        await tokenContract.methods.approve(contractAddress, amountIn).send({
            from: YOUR_ADDRESS,
            gas: '70000', // Adjust gas limit as needed
            gasPrice: web3.utils.toWei('3', 'gwei'),
        });

        console.log(`Approved token`);

        const deadline = Math.floor(Date.now() / 1000) + 60 * 2;
        contract.methods.swapExactTokensForTokens(JSON.stringify(amountIn), JSON.stringify(amountOutMin), routes, YOUR_ADDRESS, deadline)
            .send({
                from: YOUR_ADDRESS,
                gas: '400000', // Adjust gas limit as needed
                gasPrice: web3.utils.toWei('5', 'gwei'), // Set gas price
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
            console.log(data);
            if (data.bought) {
                fs.appendFile('./logData.txt', `
                    Date: ${Date()}
                    THE: $${data.logData.thePrice}
                    LiveTHE: $${data.logData.livePrice}
                    LiveTHE/THE: ${data.logData.percent}%
                    SwapTo: ${data.logData.swapTo}
                    txs: https://bscscan.com/tx/${data.logData.txsHash}
                    ---------------------------
                `, function (err) {
                    if (err) throw err;
                    console.log('Updated LogData!');
                })
            }
            await sleep(60000 * 5);
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
