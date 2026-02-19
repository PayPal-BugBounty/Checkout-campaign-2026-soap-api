# PayPal SOAP API Tester

A web-based security testing tool for PayPal's legacy NVP/SOAP APIs. Built with Next.js for easy Vercel deployment.

## Features

- **18 SOAP Operations**: GetBalance, TransactionSearch, GetTransactionDetails, SetExpressCheckout, GetExpressCheckoutDetails, DoExpressCheckoutPayment, DoDirectPayment, DoCapture, DoAuthorization, DoReauthorization, DoVoid, RefundTransaction, CreateBillingAgreement, BAUpdate, AddressVerify, GetPalDetails, DoReferenceTransaction, MassPay
- **Full HTTP Visibility**: View raw SOAP XML request and response for every call
- **Parsed Response View**: Auto-parsed key-value table with highlighted Ack status, Transaction IDs, and Tokens
- **Quick Actions**: After SetExpressCheckout, one-click to GetExpressCheckoutDetails; after payment, one-click to GetTransactionDetails or RefundTransaction
- **Sandbox/Live Toggle**: Switch environments instantly
- **Custom Credentials**: Enter your own API Username, Password, and Signature
- **3rd-Party Auth**: Optional Subject field for 3rd-party API permissions
- **Request History**: Session log of all requests with status and timing

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Click Deploy — no environment variables needed

Or use the Vercel CLI:

```bash
npm i -g vercel
vercel
```

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- **Frontend**: React (Next.js App Router) with a dark terminal-inspired UI
- **Backend**: Next.js API route (`/api/soap`) proxies SOAP requests to PayPal to avoid CORS
- **No database**: Credentials are client-side only, never stored server-side

## PayPal SOAP API Reference

- [SOAP Operations](https://developer.paypal.com/api/nvp-soap/soap/)
- [API Endpoints](https://developer.paypal.com/api/nvp-soap/endpoints/)
- [Credentials](https://developer.paypal.com/api/nvp-soap/apiCredentials/)

### Endpoints Used

| Environment | Endpoint |
|---|---|
| Sandbox | `https://api-3t.sandbox.paypal.com/2.0/` |
| Live | `https://api-3t.paypal.com/2.0/` |

API Version: 124.0
