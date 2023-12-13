require('dotenv').config();

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

const contractABI = require('./liveThePoolABI.json');
const tokenContractABI = require('./theABI.json');
const contractAddress = '0xd4ae6eCA985340Dd434D38F470aCCce4DC78D109';

const web3 = new Web3(BSC_RPC);

const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
web3.eth.defaultAccount = account.address;

const tokenContract = new web3.eth.Contract(tokenContractABI, TheAddress);

const contract = new web3.eth.Contract(contractABI, contractAddress);

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
            const diffPercent = 100 - (liveThe.priceUsd / the.priceUsd) * 100;

            console.log(`
                Date: ${Date()}
                THE: $${the.priceUsd}
                LiveTHE: $${liveThe.priceUsd}
                LiveTHE/THE: ${diffPercent}%
            `);

            if (diffPercent >= SWAP_PERCENT) {
                swapToLiveThe(resolve, reject);
            } else {
                resolve({bought: false});
            }
        }).catch((error) => {
            reject(error);
        });
    });
}

async function swapToLiveThe(resolve, reject) {
    try {
        console.log('Swapping THE to liveTHE');
        const amountIn = Number.parseFloat(AMOUNT_IN) * (10 ** 18); // 1 token in wei (adjust based on token decimals)
        const amountOutMin = Number.parseFloat(AMOUNT_OUT_MIN) * (10 ** 18); // Minimum acceptable amount of output tokens

        const routes = [{
            from: TheAddress,
            to: liveTheAddress,
            stable: true
        }];

        await tokenContract.methods.approve(contractAddress, amountIn).send({
            from: YOUR_ADDRESS,
            gas: '70000', // Adjust gas limit as needed
            gasPrice: web3.utils.toWei('3', 'gwei'),
        });

        console.log('Approved THE token');

        const deadline = Math.floor(Date.now() / 1000) + 60 * 2;
        contract.methods.swapExactTokensForTokens(JSON.stringify(amountIn), JSON.stringify(amountOutMin), routes, YOUR_ADDRESS, deadline)
            .send({
                from: YOUR_ADDRESS,
                gas: '400000', // Adjust gas limit as needed
                gasPrice: web3.utils.toWei('5', 'gwei'), // Set gas price
            })
            .then((result) => {
                console.log('Swap successful! txs: ', result.transactionHash);
                resolve({bought: true});
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
                console.log('Done');
                break;
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
