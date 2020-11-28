# koa-rate-limit-middleware

Rate limiter middleware for koa

## Installation

```sh
# npm install
npm install koa-rate-limit-middleware
# yarn install
yarn add koa-rate-limit-middleware
```

## Usage

### In memory

```javascript
const Koa = require('koa');
const ratelimit = require('koa-rate-limit-middleware');
const app = new Koa();

// rate limit middleware init
app.use(ratelimit({ driver: 'memory' }));

// response middleware
app.use(async (ctx) => {
  ctx.body = 'Stuff!';
});

// run server
app.listen(
  3000,
  () => console.log('listening on port 3000')
);
```

### Redis

To use this middleware with **Redis**, you can either

#### Use env vars

Setting the env variables `REDIS_HOST` and `REDIS_PORT` so the middleware can connect to redis.

```javascript
const Koa = require('koa');
const ratelimit = require('koa-rate-limit-middleware');
const app = new Koa();

// rate limit middleware init
app.use(ratelimit({ driver: 'redis' }));

// response middleware
app.use(async (ctx) => {
  ctx.body = 'Stuff!';
});

// run server
app.listen(
  3000,
  () => console.log('listening on port 3000')
);
```

### Use a Redis instance (recommended)

Creating the Redis instance that will be used by the middleware
```javascript
const Koa = require('koa');
const ratelimit = require('koa-rate-limit-middleware');
const Redis = require('ioredis');

const app = new Koa();

// rate limit middleware init
app.use(ratelimit({ driver: 'redis', db: new Redis() }));

// response middleware
app.use(async (ctx) => {
  ctx.body = 'Stuff!';
});

// run server
app.listen(
  3000,
  () => console.log('listening on port 3000')
);
```

## Options

These are all the available options and there default values:

| name | default | description |
|------|---------|-------------|
| driver | memory | memory or redis |
| db | Map instance | redis connection instance or Map instance
| id | ctx.ip | id to compare requests
| duration | 3600000 | of limit in milliseconds
| max | 2500 | max requests within duration
| disableHeader | false | set whether send the remaining, reset, total headers
| remaining | 'X-RateLimit-Remaining' | remaining number of requests
| reset | 'X-RateLimit-Reset' | reset timestamp
| total | 'X-RateLimit-Limit' | total number of requests
| headers | { reset: 'X-RateLimit-Reset', remaining: 'X-RateLimit-Remaining', total: 'X-RateLimit-Limit' } | custom header names
| whitelist | () => false | if function returns true, middleware exits before limiting
| blacklist | () => false | if function returns true, 403 error is thrown
| throw | true | call ctx.throw if true
| errorMessage | | custom error message

## Contributing
1. Fork it!
2. Create your feature branch: git checkout -b my-new-feature
3. Commit your changes: git commit -am 'Add some feature'
4. Push to the branch: git push origin my-new-feature
5. Submit a pull request :D

## License
The MIT License (MIT)

Copyright (c) 2020 [h1b9b](mailto:34774822+h1b9b@users.noreply.github.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
