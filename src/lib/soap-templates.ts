export interface Credentials {
  username: string;
  password: string;
  signature: string;
  environment: 'sandbox' | 'live';
  subject?: string;
}

export interface OperationField {
  name: string;
  label: string;
  required: boolean;
  type: 'text' | 'select' | 'number' | 'date';
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
  help?: string;
  namespace?: string;
}

export interface OperationDef {
  name: string;
  label: string;
  description: string;
  category: 'express_checkout' | 'payments' | 'transaction' | 'billing' | 'other';
  fields: OperationField[];
  reqTag: string;
  requestTag: string;
}

export function getEndpoint(creds: Credentials): string {
  if (creds.environment === 'sandbox') {
    return 'https://api-3t.sandbox.paypal.com/2.0/';
  }
  return 'https://api-3t.paypal.com/2.0/';
}

export function getNvpEndpoint(creds: Credentials): string {
  if (creds.environment === 'sandbox') {
    return 'https://api-3t.sandbox.paypal.com/nvp';
  }
  return 'https://api-3t.paypal.com/nvp';
}

export function buildSoapEnvelope(creds: Credentials, operation: OperationDef, params: Record<string, string>): string {
  const fieldXml = operation.fields
    .filter(f => params[f.name] && params[f.name].trim() !== '')
    .map(f => {
      const ns = f.namespace || '';
      const nsAttr = ns ? ` xmlns="${ns}"` : '';
      return `        <${f.name}${nsAttr}>${escapeXml(params[f.name])}</${f.name}>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:ns="urn:ebay:api:PayPalAPI"
  xmlns:ebl="urn:ebay:apis:eBLBaseComponents">
  <SOAP-ENV:Header>
    <RequesterCredentials xmlns="urn:ebay:api:PayPalAPI" SOAP-ENV:mustUnderstand="1">
      <Credentials xmlns="urn:ebay:apis:eBLBaseComponents">
        <Username>${escapeXml(creds.username)}</Username>
        <Password>${escapeXml(creds.password)}</Password>
        <Signature>${escapeXml(creds.signature)}</Signature>${creds.subject ? `\n        <Subject>${escapeXml(creds.subject)}</Subject>` : ''}
      </Credentials>
    </RequesterCredentials>
  </SOAP-ENV:Header>
  <SOAP-ENV:Body>
    <${operation.reqTag} xmlns="urn:ebay:api:PayPalAPI">
      <${operation.requestTag}>
        <Version xmlns="urn:ebay:apis:eBLBaseComponents">124.0</Version>
${fieldXml}
      </${operation.requestTag}>
    </${operation.reqTag}>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

export function buildExpressCheckoutSoapEnvelope(creds: Credentials, params: Record<string, string>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:ns="urn:ebay:api:PayPalAPI"
  xmlns:ebl="urn:ebay:apis:eBLBaseComponents">
  <SOAP-ENV:Header>
    <RequesterCredentials xmlns="urn:ebay:api:PayPalAPI" SOAP-ENV:mustUnderstand="1">
      <Credentials xmlns="urn:ebay:apis:eBLBaseComponents">
        <Username>${escapeXml(creds.username)}</Username>
        <Password>${escapeXml(creds.password)}</Password>
        <Signature>${escapeXml(creds.signature)}</Signature>${creds.subject ? `\n        <Subject>${escapeXml(creds.subject)}</Subject>` : ''}
      </Credentials>
    </RequesterCredentials>
  </SOAP-ENV:Header>
  <SOAP-ENV:Body>
    <SetExpressCheckoutReq xmlns="urn:ebay:api:PayPalAPI">
      <SetExpressCheckoutRequest>
        <Version xmlns="urn:ebay:apis:eBLBaseComponents">124.0</Version>
        <SetExpressCheckoutRequestDetails xmlns="urn:ebay:apis:eBLBaseComponents">
          <ReturnURL>${escapeXml(params.ReturnURL || 'https://example.com/success')}</ReturnURL>
          <CancelURL>${escapeXml(params.CancelURL || 'https://example.com/cancel')}</CancelURL>
          <PaymentDetails>
            <OrderTotal currencyID="${escapeXml(params.CurrencyCode || 'USD')}">${escapeXml(params.OrderTotal || '10.00')}</OrderTotal>
            <PaymentAction>${escapeXml(params.PaymentAction || 'Sale')}</PaymentAction>${params.OrderDescription ? `\n            <OrderDescription>${escapeXml(params.OrderDescription)}</OrderDescription>` : ''}${params.InvoiceID ? `\n            <InvoiceID>${escapeXml(params.InvoiceID)}</InvoiceID>` : ''}
          </PaymentDetails>${params.NoShipping ? `\n          <NoShipping>${escapeXml(params.NoShipping)}</NoShipping>` : ''}${params.LocaleCode ? `\n          <LocaleCode>${escapeXml(params.LocaleCode)}</LocaleCode>` : ''}${params.BrandName ? `\n          <BrandName>${escapeXml(params.BrandName)}</BrandName>` : ''}
        </SetExpressCheckoutRequestDetails>
      </SetExpressCheckoutRequest>
    </SetExpressCheckoutReq>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

export function buildDoExpressCheckoutSoapEnvelope(creds: Credentials, params: Record<string, string>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:ns="urn:ebay:api:PayPalAPI"
  xmlns:ebl="urn:ebay:apis:eBLBaseComponents">
  <SOAP-ENV:Header>
    <RequesterCredentials xmlns="urn:ebay:api:PayPalAPI" SOAP-ENV:mustUnderstand="1">
      <Credentials xmlns="urn:ebay:apis:eBLBaseComponents">
        <Username>${escapeXml(creds.username)}</Username>
        <Password>${escapeXml(creds.password)}</Password>
        <Signature>${escapeXml(creds.signature)}</Signature>
      </Credentials>
    </RequesterCredentials>
  </SOAP-ENV:Header>
  <SOAP-ENV:Body>
    <DoExpressCheckoutPaymentReq xmlns="urn:ebay:api:PayPalAPI">
      <DoExpressCheckoutPaymentRequest>
        <Version xmlns="urn:ebay:apis:eBLBaseComponents">124.0</Version>
        <DoExpressCheckoutPaymentRequestDetails xmlns="urn:ebay:apis:eBLBaseComponents">
          <Token>${escapeXml(params.Token)}</Token>
          <PayerID>${escapeXml(params.PayerID)}</PayerID>
          <PaymentDetails>
            <OrderTotal currencyID="${escapeXml(params.CurrencyCode || 'USD')}">${escapeXml(params.OrderTotal)}</OrderTotal>
            <PaymentAction>${escapeXml(params.PaymentAction || 'Sale')}</PaymentAction>
          </PaymentDetails>
        </DoExpressCheckoutPaymentRequestDetails>
      </DoExpressCheckoutPaymentRequest>
    </DoExpressCheckoutPaymentReq>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

export function buildDoDirectPaymentSoapEnvelope(creds: Credentials, params: Record<string, string>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:ns="urn:ebay:api:PayPalAPI"
  xmlns:ebl="urn:ebay:apis:eBLBaseComponents">
  <SOAP-ENV:Header>
    <RequesterCredentials xmlns="urn:ebay:api:PayPalAPI" SOAP-ENV:mustUnderstand="1">
      <Credentials xmlns="urn:ebay:apis:eBLBaseComponents">
        <Username>${escapeXml(creds.username)}</Username>
        <Password>${escapeXml(creds.password)}</Password>
        <Signature>${escapeXml(creds.signature)}</Signature>
      </Credentials>
    </RequesterCredentials>
  </SOAP-ENV:Header>
  <SOAP-ENV:Body>
    <DoDirectPaymentReq xmlns="urn:ebay:api:PayPalAPI">
      <DoDirectPaymentRequest>
        <Version xmlns="urn:ebay:apis:eBLBaseComponents">124.0</Version>
        <DoDirectPaymentRequestDetails xmlns="urn:ebay:apis:eBLBaseComponents">
          <PaymentAction>${escapeXml(params.PaymentAction || 'Sale')}</PaymentAction>
          <PaymentDetails>
            <OrderTotal currencyID="${escapeXml(params.CurrencyCode || 'USD')}">${escapeXml(params.OrderTotal)}</OrderTotal>${params.OrderDescription ? `\n            <OrderDescription>${escapeXml(params.OrderDescription)}</OrderDescription>` : ''}
          </PaymentDetails>
          <CreditCard>
            <CreditCardType>${escapeXml(params.CreditCardType || 'Visa')}</CreditCardType>
            <CreditCardNumber>${escapeXml(params.CreditCardNumber)}</CreditCardNumber>
            <ExpMonth>${escapeXml(params.ExpMonth)}</ExpMonth>
            <ExpYear>${escapeXml(params.ExpYear)}</ExpYear>
            <CVV2>${escapeXml(params.CVV2)}</CVV2>
            <CardOwner>
              <PayerName>
                <FirstName>${escapeXml(params.FirstName)}</FirstName>
                <LastName>${escapeXml(params.LastName)}</LastName>
              </PayerName>
              <Address>
                <Street1>${escapeXml(params.Street1 || '1 Main St')}</Street1>
                <CityName>${escapeXml(params.CityName || 'San Jose')}</CityName>
                <StateOrProvince>${escapeXml(params.StateOrProvince || 'CA')}</StateOrProvince>
                <PostalCode>${escapeXml(params.PostalCode || '95131')}</PostalCode>
                <Country>${escapeXml(params.Country || 'US')}</Country>
              </Address>
            </CardOwner>
          </CreditCard>
          <IPAddress>${escapeXml(params.IPAddress || '127.0.0.1')}</IPAddress>
        </DoDirectPaymentRequestDetails>
      </DoDirectPaymentRequest>
    </DoDirectPaymentReq>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

export function buildRefundSoapEnvelope(creds: Credentials, params: Record<string, string>): string {
  const isPartial = params.RefundType === 'Partial';
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:ns="urn:ebay:api:PayPalAPI"
  xmlns:ebl="urn:ebay:apis:eBLBaseComponents">
  <SOAP-ENV:Header>
    <RequesterCredentials xmlns="urn:ebay:api:PayPalAPI" SOAP-ENV:mustUnderstand="1">
      <Credentials xmlns="urn:ebay:apis:eBLBaseComponents">
        <Username>${escapeXml(creds.username)}</Username>
        <Password>${escapeXml(creds.password)}</Password>
        <Signature>${escapeXml(creds.signature)}</Signature>
      </Credentials>
    </RequesterCredentials>
  </SOAP-ENV:Header>
  <SOAP-ENV:Body>
    <RefundTransactionReq xmlns="urn:ebay:api:PayPalAPI">
      <RefundTransactionRequest>
        <Version xmlns="urn:ebay:apis:eBLBaseComponents">124.0</Version>
        <TransactionID>${escapeXml(params.TransactionID)}</TransactionID>
        <RefundType>${escapeXml(params.RefundType || 'Full')}</RefundType>${isPartial && params.Amount ? `\n        <Amount currencyID="${escapeXml(params.CurrencyCode || 'USD')}">${escapeXml(params.Amount)}</Amount>` : ''}${params.Memo ? `\n        <Memo>${escapeXml(params.Memo)}</Memo>` : ''}
      </RefundTransactionRequest>
    </RefundTransactionReq>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const OPERATIONS: OperationDef[] = [
  // === TRANSACTION ===
  {
    name: 'GetBalance',
    label: 'GetBalance',
    description: 'Get the balance of your PayPal account',
    category: 'transaction',
    reqTag: 'GetBalanceReq',
    requestTag: 'GetBalanceRequest',
    fields: [
      { name: 'ReturnAllCurrencies', label: 'Return All Currencies', required: false, type: 'select',
        options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }], defaultValue: '1' }
    ]
  },
  {
    name: 'TransactionSearch',
    label: 'TransactionSearch',
    description: 'Search transaction history by date range, email, amount, etc.',
    category: 'transaction',
    reqTag: 'TransactionSearchReq',
    requestTag: 'TransactionSearchRequest',
    fields: [
      { name: 'StartDate', label: 'Start Date (ISO)', required: true, type: 'text', placeholder: '2024-01-01T00:00:00Z' },
      { name: 'EndDate', label: 'End Date (ISO)', required: false, type: 'text', placeholder: '2024-12-31T23:59:59Z' },
      { name: 'Payer', label: 'Payer Email', required: false, type: 'text', placeholder: 'buyer@example.com' },
      { name: 'Receiver', label: 'Receiver Email', required: false, type: 'text' },
      { name: 'TransactionID', label: 'Transaction ID', required: false, type: 'text' },
      { name: 'InvoiceID', label: 'Invoice ID', required: false, type: 'text' },
      { name: 'TransactionClass', label: 'Transaction Class', required: false, type: 'select',
        options: [
          { value: '', label: '-- Any --' },
          { value: 'All', label: 'All' },
          { value: 'Sent', label: 'Sent' },
          { value: 'Received', label: 'Received' },
          { value: 'MassPay', label: 'MassPay' },
          { value: 'MoneyRequest', label: 'MoneyRequest' },
          { value: 'FundsAdded', label: 'FundsAdded' },
          { value: 'FundsWithdrawn', label: 'FundsWithdrawn' },
          { value: 'Referral', label: 'Referral' },
          { value: 'Fee', label: 'Fee' },
          { value: 'Subscription', label: 'Subscription' },
          { value: 'Dividend', label: 'Dividend' },
          { value: 'Billpay', label: 'Billpay' },
          { value: 'Refund', label: 'Refund' },
          { value: 'CurrencyConversions', label: 'CurrencyConversions' },
          { value: 'BalanceTransfer', label: 'BalanceTransfer' },
          { value: 'Reversal', label: 'Reversal' },
          { value: 'Shipping', label: 'Shipping' },
          { value: 'BalanceAffecting', label: 'BalanceAffecting' },
          { value: 'ECheck', label: 'ECheck' },
        ]
      },
      { name: 'Status', label: 'Payment Status', required: false, type: 'select',
        options: [
          { value: '', label: '-- Any --' },
          { value: 'Pending', label: 'Pending' },
          { value: 'Processing', label: 'Processing' },
          { value: 'Success', label: 'Success' },
          { value: 'Denied', label: 'Denied' },
          { value: 'Reversed', label: 'Reversed' },
        ]
      },
    ]
  },
  {
    name: 'GetTransactionDetails',
    label: 'GetTransactionDetails',
    description: 'Get detailed info about a specific transaction',
    category: 'transaction',
    reqTag: 'GetTransactionDetailsReq',
    requestTag: 'GetTransactionDetailsRequest',
    fields: [
      { name: 'TransactionID', label: 'Transaction ID', required: true, type: 'text', placeholder: 'e.g., 5V2862XXXXXXXXXXX' }
    ]
  },
  // === EXPRESS CHECKOUT ===
  {
    name: 'SetExpressCheckout',
    label: 'SetExpressCheckout',
    description: 'Initiate an Express Checkout transaction and get a token',
    category: 'express_checkout',
    reqTag: 'SetExpressCheckoutReq',
    requestTag: 'SetExpressCheckoutRequest',
    fields: [
      { name: 'OrderTotal', label: 'Order Total', required: true, type: 'text', placeholder: '10.00', defaultValue: '10.00' },
      { name: 'CurrencyCode', label: 'Currency', required: false, type: 'select',
        options: [
          { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
          { value: 'CAD', label: 'CAD' }, { value: 'AUD', label: 'AUD' }, { value: 'JPY', label: 'JPY' },
        ], defaultValue: 'USD' },
      { name: 'PaymentAction', label: 'Payment Action', required: false, type: 'select',
        options: [
          { value: 'Sale', label: 'Sale' }, { value: 'Authorization', label: 'Authorization' }, { value: 'Order', label: 'Order' }
        ], defaultValue: 'Sale' },
      { name: 'ReturnURL', label: 'Return URL', required: true, type: 'text', placeholder: 'https://example.com/success', defaultValue: 'https://example.com/success' },
      { name: 'CancelURL', label: 'Cancel URL', required: true, type: 'text', placeholder: 'https://example.com/cancel', defaultValue: 'https://example.com/cancel' },
      { name: 'OrderDescription', label: 'Order Description', required: false, type: 'text', placeholder: 'Test order' },
      { name: 'InvoiceID', label: 'Invoice ID', required: false, type: 'text' },
      { name: 'BrandName', label: 'Brand Name', required: false, type: 'text', placeholder: 'My Store' },
      { name: 'NoShipping', label: 'No Shipping', required: false, type: 'select',
        options: [{ value: '', label: '-- Default --' }, { value: '0', label: '0 - Display address' }, { value: '1', label: '1 - No display' }, { value: '2', label: '2 - Require address' }]
      },
      { name: 'LocaleCode', label: 'Locale Code', required: false, type: 'text', placeholder: 'US' },
    ]
  },
  {
    name: 'GetExpressCheckoutDetails',
    label: 'GetExpressCheckoutDetails',
    description: 'Get details of an Express Checkout transaction by token',
    category: 'express_checkout',
    reqTag: 'GetExpressCheckoutDetailsReq',
    requestTag: 'GetExpressCheckoutDetailsRequest',
    fields: [
      { name: 'Token', label: 'EC Token', required: true, type: 'text', placeholder: 'EC-XXXXXXXXXXXXXXXXX' }
    ]
  },
  {
    name: 'DoExpressCheckoutPayment',
    label: 'DoExpressCheckoutPayment',
    description: 'Complete an Express Checkout payment',
    category: 'express_checkout',
    reqTag: 'DoExpressCheckoutPaymentReq',
    requestTag: 'DoExpressCheckoutPaymentRequest',
    fields: [
      { name: 'Token', label: 'EC Token', required: true, type: 'text', placeholder: 'EC-XXXXXXXXXXXXXXXXX' },
      { name: 'PayerID', label: 'Payer ID', required: true, type: 'text', placeholder: 'BUYERID123' },
      { name: 'OrderTotal', label: 'Order Total', required: true, type: 'text', placeholder: '10.00' },
      { name: 'CurrencyCode', label: 'Currency', required: false, type: 'select',
        options: [
          { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
        ], defaultValue: 'USD' },
      { name: 'PaymentAction', label: 'Payment Action', required: false, type: 'select',
        options: [
          { value: 'Sale', label: 'Sale' }, { value: 'Authorization', label: 'Authorization' }, { value: 'Order', label: 'Order' }
        ], defaultValue: 'Sale' },
    ]
  },
  // === PAYMENTS ===
  {
    name: 'DoDirectPayment',
    label: 'DoDirectPayment',
    description: 'Process a credit card payment directly (Payments Pro)',
    category: 'payments',
    reqTag: 'DoDirectPaymentReq',
    requestTag: 'DoDirectPaymentRequest',
    fields: [
      { name: 'PaymentAction', label: 'Payment Action', required: true, type: 'select',
        options: [{ value: 'Sale', label: 'Sale' }, { value: 'Authorization', label: 'Authorization' }], defaultValue: 'Sale' },
      { name: 'OrderTotal', label: 'Order Total', required: true, type: 'text', placeholder: '10.00' },
      { name: 'CurrencyCode', label: 'Currency', required: false, type: 'text', defaultValue: 'USD' },
      { name: 'CreditCardType', label: 'Card Type', required: true, type: 'select',
        options: [{ value: 'Visa', label: 'Visa' }, { value: 'MasterCard', label: 'MasterCard' }, { value: 'Discover', label: 'Discover' }, { value: 'Amex', label: 'Amex' }] },
      { name: 'CreditCardNumber', label: 'Card Number', required: true, type: 'text', placeholder: '4111111111111111' },
      { name: 'ExpMonth', label: 'Exp Month', required: true, type: 'text', placeholder: '12' },
      { name: 'ExpYear', label: 'Exp Year', required: true, type: 'text', placeholder: '2028' },
      { name: 'CVV2', label: 'CVV2', required: true, type: 'text', placeholder: '123' },
      { name: 'FirstName', label: 'First Name', required: true, type: 'text', placeholder: 'John' },
      { name: 'LastName', label: 'Last Name', required: true, type: 'text', placeholder: 'Doe' },
      { name: 'Street1', label: 'Street', required: false, type: 'text', defaultValue: '1 Main St' },
      { name: 'CityName', label: 'City', required: false, type: 'text', defaultValue: 'San Jose' },
      { name: 'StateOrProvince', label: 'State', required: false, type: 'text', defaultValue: 'CA' },
      { name: 'PostalCode', label: 'Postal Code', required: false, type: 'text', defaultValue: '95131' },
      { name: 'Country', label: 'Country', required: false, type: 'text', defaultValue: 'US' },
      { name: 'IPAddress', label: 'IP Address', required: false, type: 'text', defaultValue: '127.0.0.1' },
      { name: 'OrderDescription', label: 'Description', required: false, type: 'text' },
    ]
  },
  {
    name: 'DoCapture',
    label: 'DoCapture',
    description: 'Capture a previously authorized payment',
    category: 'payments',
    reqTag: 'DoCaptureReq',
    requestTag: 'DoCaptureRequest',
    fields: [
      { name: 'AuthorizationID', label: 'Authorization ID', required: true, type: 'text' },
      { name: 'Amount', label: 'Amount', required: true, type: 'text', placeholder: '10.00',
        namespace: 'urn:ebay:apis:eBLBaseComponents' },
      { name: 'CompleteType', label: 'Complete Type', required: true, type: 'select',
        options: [{ value: 'Complete', label: 'Complete' }, { value: 'NotComplete', label: 'Not Complete' }], defaultValue: 'Complete' },
      { name: 'InvoiceID', label: 'Invoice ID', required: false, type: 'text' },
      { name: 'Note', label: 'Note', required: false, type: 'text' },
    ]
  },
  {
    name: 'DoAuthorization',
    label: 'DoAuthorization',
    description: 'Authorize a payment for later capture',
    category: 'payments',
    reqTag: 'DoAuthorizationReq',
    requestTag: 'DoAuthorizationRequest',
    fields: [
      { name: 'TransactionID', label: 'Transaction ID', required: true, type: 'text' },
      { name: 'Amount', label: 'Amount', required: true, type: 'text', placeholder: '10.00',
        namespace: 'urn:ebay:apis:eBLBaseComponents' },
    ]
  },
  {
    name: 'DoReauthorization',
    label: 'DoReauthorization',
    description: 'Reauthorize an expired authorization',
    category: 'payments',
    reqTag: 'DoReauthorizationReq',
    requestTag: 'DoReauthorizationRequest',
    fields: [
      { name: 'AuthorizationID', label: 'Authorization ID', required: true, type: 'text' },
      { name: 'Amount', label: 'Amount', required: true, type: 'text',
        namespace: 'urn:ebay:apis:eBLBaseComponents' },
    ]
  },
  {
    name: 'DoVoid',
    label: 'DoVoid',
    description: 'Void a previously authorized transaction',
    category: 'payments',
    reqTag: 'DoVoidReq',
    requestTag: 'DoVoidRequest',
    fields: [
      { name: 'AuthorizationID', label: 'Authorization ID', required: true, type: 'text' },
      { name: 'Note', label: 'Note', required: false, type: 'text' },
    ]
  },
  {
    name: 'RefundTransaction',
    label: 'RefundTransaction',
    description: 'Refund a completed transaction (full or partial)',
    category: 'payments',
    reqTag: 'RefundTransactionReq',
    requestTag: 'RefundTransactionRequest',
    fields: [
      { name: 'TransactionID', label: 'Transaction ID', required: true, type: 'text' },
      { name: 'RefundType', label: 'Refund Type', required: true, type: 'select',
        options: [{ value: 'Full', label: 'Full' }, { value: 'Partial', label: 'Partial' }], defaultValue: 'Full' },
      { name: 'Amount', label: 'Amount (for Partial)', required: false, type: 'text', placeholder: '5.00' },
      { name: 'CurrencyCode', label: 'Currency', required: false, type: 'text', defaultValue: 'USD' },
      { name: 'Memo', label: 'Memo/Note', required: false, type: 'text' },
    ]
  },
  // === BILLING ===
  {
    name: 'CreateBillingAgreement',
    label: 'CreateBillingAgreement',
    description: 'Create a billing agreement from an EC token',
    category: 'billing',
    reqTag: 'CreateBillingAgreementReq',
    requestTag: 'CreateBillingAgreementRequest',
    fields: [
      { name: 'Token', label: 'EC Token', required: true, type: 'text' },
    ]
  },
  {
    name: 'BAUpdate',
    label: 'BAUpdate',
    description: 'Update or query a billing agreement',
    category: 'billing',
    reqTag: 'BillAgreementUpdateReq',
    requestTag: 'BAUpdateRequest',
    fields: [
      { name: 'ReferenceID', label: 'Billing Agreement ID', required: true, type: 'text' },
      { name: 'BillingAgreementStatus', label: 'Status', required: false, type: 'select',
        options: [{ value: '', label: '-- Query Only --' }, { value: 'Canceled', label: 'Cancel Agreement' }] },
    ]
  },
  // === OTHER ===
  {
    name: 'AddressVerify',
    label: 'AddressVerify',
    description: 'Verify a street address against PayPal records',
    category: 'other',
    reqTag: 'AddressVerifyReq',
    requestTag: 'AddressVerifyRequest',
    fields: [
      { name: 'Email', label: 'PayPal Email', required: true, type: 'text' },
      { name: 'Street', label: 'Street Address', required: true, type: 'text' },
      { name: 'Zip', label: 'Zip Code', required: true, type: 'text' },
    ]
  },
  {
    name: 'GetPalDetails',
    label: 'GetPalDetails',
    description: 'Get PayPal account details (PAL ID)',
    category: 'other',
    reqTag: 'GetPalDetailsReq',
    requestTag: 'GetPalDetailsRequest',
    fields: []
  },
  {
    name: 'DoReferenceTransaction',
    label: 'DoReferenceTransaction',
    description: 'Process a payment using a reference (billing agreement or previous txn)',
    category: 'payments',
    reqTag: 'DoReferenceTransactionReq',
    requestTag: 'DoReferenceTransactionRequest',
    fields: [
      { name: 'ReferenceID', label: 'Reference ID (BA or TXN ID)', required: true, type: 'text' },
      { name: 'PaymentAction', label: 'Payment Action', required: true, type: 'select',
        options: [{ value: 'Sale', label: 'Sale' }, { value: 'Authorization', label: 'Authorization' }], defaultValue: 'Sale' },
      { name: 'Amount', label: 'Amount', required: true, type: 'text', placeholder: '10.00',
        namespace: 'urn:ebay:apis:eBLBaseComponents' },
      { name: 'CurrencyCode', label: 'Currency', required: false, type: 'text', defaultValue: 'USD' },
    ]
  },
  {
    name: 'MassPay',
    label: 'MassPay',
    description: 'Send payments to multiple recipients',
    category: 'payments',
    reqTag: 'MassPayReq',
    requestTag: 'MassPayRequest',
    fields: [
      { name: 'ReceiverType', label: 'Receiver Type', required: true, type: 'select',
        options: [{ value: 'EmailAddress', label: 'Email Address' }, { value: 'UserID', label: 'User ID' }], defaultValue: 'EmailAddress' },
      { name: 'ReceiverEmail', label: 'Receiver Email', required: true, type: 'text' },
      { name: 'Amount', label: 'Amount', required: true, type: 'text', placeholder: '10.00' },
      { name: 'CurrencyCode', label: 'Currency', required: false, type: 'text', defaultValue: 'USD' },
    ]
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  express_checkout: 'Express Checkout',
  payments: 'Payments & Captures',
  transaction: 'Transaction Queries',
  billing: 'Billing Agreements',
  other: 'Other',
};

// Determines which operations need custom envelope builders
export function getCustomBuilderOps(): string[] {
  return ['SetExpressCheckout', 'DoExpressCheckoutPayment', 'DoDirectPayment', 'RefundTransaction'];
}
