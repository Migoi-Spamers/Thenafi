# Thenafi
Swap THE token to liveTHE token when different price and reverse.
Everytime 1.5m app will be tracking the price of The and liveThe.
Price get from https://api.dexscreener.com/latest/dex/pairs/bsc/0x3765476BfFE43Cf4c0656bF3A7529c54ae247056

# env tutorial
```
# rate execute a swapping [the => livethe]
example: SWAPPING_THE_TO_LIVETHE_RATE = 0.93

# rate execute a swapping [livethe => the]
example: SWAPPING_LIVETHE_TO_THE_RATE = 0.985

# your address and private key of the address
YOUR_ADDRESS = 
PRIVATE_KEY = 

# I want to know what your address is holding livethe or the to swapping.
# If your wallet is holding `the` should be `true` value or holding `livethe` should be `false` value.
HOLDING_THE =

```


# Running
- make .env file.
- copy .env_exampe content to .evn.
- Fill in variables on .env file.
- Run `npm install`
- Run `npm run dev`
