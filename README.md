# PAPI Remote Proxy Tool

PAPI Remote Proxy Tool is a dApp to create and submit remote proxy calls.

A remote proxy call is when you have a proxy account in a relay chain, and wish to perform a call in its name in a supported parachain.

If the proxy is controlled by a multisig, it also lets you create shareable URLs with the multisig call info pre-poplated (chain, call data and multisig account), so you can share it with your peers, and every member of the multisig will be able to approve the call.

## Getting started

It's built with React and Vite, so to run it in dev mode:

```sh
pnpm i
pnpm dev
```
