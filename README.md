# Thenafi
Swap THE token to liveTHE token when different price
Everytime 15m app will be tracking the price of The and The. If the percent of prices >= your expected percent when dapp will be swap The to liveThe
```
diffPercent = 100 - (the.priceUsd / liveThe.priceUsd) * 100

diffPercent >= SWAP_PERCENT =>> trigger swapping
```


# Tutorial
- make .env file.
- copy .env_exampe content to .evn.
- Fill in variables on .env file.
- Run `npm run dev`
