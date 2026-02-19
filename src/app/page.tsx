'use client';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Credentials,
  OperationDef,
  OPERATIONS,
  CATEGORY_LABELS,
  getEndpoint,
  buildSoapEnvelope,
  buildExpressCheckoutSoapEnvelope,
  buildDoExpressCheckoutSoapEnvelope,
  buildDoDirectPaymentSoapEnvelope,
  buildRefundSoapEnvelope,
  getCustomBuilderOps,
} from '@/lib/soap-templates';

interface LogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  status: 'success' | 'failure' | 'pending';
  httpStatus: number;
  elapsed: number;
  requestXml: string;
  responseXml: string;
  endpoint: string;
  ack?: string;
  correlationId?: string;
}

function formatXml(xml: string): string {
  try {
    let formatted = '';
    let indent = 0;
    const parts = xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/);
    parts.forEach(part => {
      if (!part.trim()) return;
      if (part.match(/^<\?/)) {
        formatted += part + '\n';
      } else if (part.match(/^<\//)) {
        indent--;
        formatted += '  '.repeat(Math.max(0, indent)) + part + '\n';
      } else if (part.match(/\/>$/)) {
        formatted += '  '.repeat(indent) + part + '\n';
      } else if (part.match(/^</)) {
        formatted += '  '.repeat(indent) + part + '\n';
        if (!part.match(/<.*\/>/)) indent++;
      } else {
        formatted += '  '.repeat(indent) + part + '\n';
        // If next is a closing tag, don't increment
      }
    });
    return formatted.trim();
  } catch {
    return xml;
  }
}

function parseXmlToKeyValues(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Simple regex-based parser for SOAP response key values
  const tagRegex = /<([a-zA-Z0-9:]+)([^>]*)>([^<]*)<\/\1>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    const tag = match[1].replace(/^[a-z]+:/i, ''); // strip namespace prefix
    const value = match[3].trim();
    if (value) {
      // Handle currency attributes
      const currAttr = match[2].match(/currencyID="([^"]+)"/);
      if (currAttr) {
        result[tag] = `${value} ${currAttr[1]}`;
      } else {
        result[tag] = value;
      }
    }
  }
  return result;
}

function extractAck(xml: string): string {
  const match = xml.match(/<Ack[^>]*>([^<]+)<\/Ack>/);
  return match ? match[1] : 'Unknown';
}

function extractCorrelationId(xml: string): string {
  const match = xml.match(/<CorrelationID[^>]*>([^<]+)<\/CorrelationID>/);
  return match ? match[1] : '';
}

export default function Home() {
  const [creds, setCreds] = useState<Credentials>({
    username: '',
    password: '',
    signature: '',
    environment: 'sandbox',
  });
  const [showCreds, setShowCreds] = useState<Record<string, boolean>>({});
  const [selectedOp, setSelectedOp] = useState<OperationDef>(OPERATIONS[0]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [httpTab, setHttpTab] = useState<'request' | 'response' | 'parsed'>('parsed');
  const [copyTooltip, setCopyTooltip] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // Initialize default values when operation changes
  useEffect(() => {
    const defaults: Record<string, string> = {};
    selectedOp.fields.forEach(f => {
      if (f.defaultValue) defaults[f.name] = f.defaultValue;
    });
    setParams(defaults);
  }, [selectedOp]);

  const setParam = useCallback((key: string, val: string) => {
    setParams(prev => ({ ...prev, [key]: val }));
  }, []);

  const executeRequest = useCallback(async () => {
    if (loading) return;
    if (!creds.username || !creds.password || !creds.signature) {
      alert('Please fill in all API credentials (Username, Password, Signature)');
      return;
    }

    setLoading(true);
    const endpoint = getEndpoint(creds);
    let soapXml: string;

    const customOps = getCustomBuilderOps();
    if (customOps.includes(selectedOp.name)) {
      switch (selectedOp.name) {
        case 'SetExpressCheckout':
          soapXml = buildExpressCheckoutSoapEnvelope(creds, params);
          break;
        case 'DoExpressCheckoutPayment':
          soapXml = buildDoExpressCheckoutSoapEnvelope(creds, params);
          break;
        case 'DoDirectPayment':
          soapXml = buildDoDirectPaymentSoapEnvelope(creds, params);
          break;
        case 'RefundTransaction':
          soapXml = buildRefundSoapEnvelope(creds, params);
          break;
        default:
          soapXml = buildSoapEnvelope(creds, selectedOp, params);
      }
    } else {
      soapXml = buildSoapEnvelope(creds, selectedOp, params);
    }

    const entry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      operation: selectedOp.name,
      status: 'pending',
      httpStatus: 0,
      elapsed: 0,
      requestXml: soapXml,
      responseXml: '',
      endpoint,
    };

    setLog(prev => [entry, ...prev]);
    setSelectedLog(entry);
    setHttpTab('request');

    try {
      const resp = await fetch('/api/soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, soapXml }),
      });

      const data = await resp.json();

      if (data.error) {
        entry.status = 'failure';
        entry.responseXml = data.error;
        entry.httpStatus = 0;
        entry.elapsed = 0;
      } else {
        const ack = extractAck(data.body);
        entry.httpStatus = data.status;
        entry.elapsed = data.elapsed;
        entry.responseXml = data.body;
        entry.ack = ack;
        entry.correlationId = extractCorrelationId(data.body);
        entry.status = (ack === 'Success' || ack === 'SuccessWithWarning') ? 'success' : 'failure';
      }
    } catch (err: unknown) {
      entry.status = 'failure';
      entry.responseXml = err instanceof Error ? err.message : 'Network error';
    }

    setLog(prev => prev.map(e => e.id === entry.id ? { ...entry } : e));
    setSelectedLog({ ...entry });
    setHttpTab('parsed');
    setLoading(false);
  }, [creds, selectedOp, params, loading]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyTooltip(label);
      setTimeout(() => setCopyTooltip(''), 1500);
    } catch { /* ignore */ }
  }, []);

  const grouped = OPERATIONS.reduce((acc, op) => {
    if (!acc[op.category]) acc[op.category] = [];
    acc[op.category].push(op);
    return acc;
  }, {} as Record<string, OperationDef[]>);

  const categoryOrder = ['transaction', 'express_checkout', 'payments', 'billing', 'other'];

  const viewEntry = selectedLog;
  const parsedResponse = viewEntry?.responseXml ? parseXmlToKeyValues(viewEntry.responseXml) : {};

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <span className="dot" />
          PayPal SOAP Tester
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          v124.0 &middot; {OPERATIONS.length} operations
        </div>
        <div className="header-env">
          <span className={`env-badge ${creds.environment}`}>
            {creds.environment}
          </span>
          <div className="toggle-row">
            <span style={{ color: creds.environment === 'sandbox' ? 'var(--blue)' : 'var(--text-muted)' }}>SB</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={creds.environment === 'live'}
                onChange={(e) => setCreds(prev => ({ ...prev, environment: e.target.checked ? 'live' : 'sandbox' }))}
              />
              <span className="toggle-slider" />
            </label>
            <span style={{ color: creds.environment === 'live' ? 'var(--red)' : 'var(--text-muted)' }}>LIVE</span>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        {/* Credentials */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">API Credentials</div>
          <div className="cred-grid">
            <div>
              <label>API Username</label>
              <input
                type="text"
                value={creds.username}
                onChange={e => setCreds(prev => ({ ...prev, username: e.target.value }))}
                placeholder="user_api1.example.com"
                spellCheck={false}
              />
            </div>
            <div>
              <label>API Password</label>
              <div className="input-with-toggle">
                <input
                  type={showCreds['password'] ? 'text' : 'password'}
                  value={creds.password}
                  onChange={e => setCreds(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  spellCheck={false}
                />
                <button
                  className="visibility-btn"
                  onClick={() => setShowCreds(p => ({ ...p, password: !p.password }))}
                  tabIndex={-1}
                  type="button"
                >
                  {showCreds['password'] ? '◉' : '○'}
                </button>
              </div>
            </div>
            <div>
              <label>API Signature</label>
              <div className="input-with-toggle">
                <input
                  type={showCreds['signature'] ? 'text' : 'password'}
                  value={creds.signature}
                  onChange={e => setCreds(prev => ({ ...prev, signature: e.target.value }))}
                  placeholder="••••••••••••"
                  spellCheck={false}
                />
                <button
                  className="visibility-btn"
                  onClick={() => setShowCreds(p => ({ ...p, signature: !p.signature }))}
                  tabIndex={-1}
                  type="button"
                >
                  {showCreds['signature'] ? '◉' : '○'}
                </button>
              </div>
            </div>
            <div>
              <label>Subject (optional 3rd-party)</label>
              <input
                type="text"
                value={creds.subject || ''}
                onChange={e => setCreds(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="merchant@example.com"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        {/* Operations */}
        <div className="sidebar-section" style={{ flex: 1 }}>
          <div className="sidebar-section-title">Operations</div>
          {categoryOrder.map(cat => (
            <div key={cat} className="op-category">
              <div className="op-category-label">{CATEGORY_LABELS[cat]}</div>
              {(grouped[cat] || []).map(op => (
                <div
                  key={op.name}
                  className={`op-item ${selectedOp.name === op.name ? 'active' : ''}`}
                  onClick={() => setSelectedOp(op)}
                >
                  <span className="arrow">›</span>
                  {op.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Log */}
        <div className="sidebar-section" style={{ borderBottom: 'none' }}>
          <div className="sidebar-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            History ({log.length})
            {log.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setLog([]); setSelectedLog(null); }} style={{ fontSize: 10, padding: '2px 6px' }}>
                Clear
              </button>
            )}
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {log.map(entry => (
              <div
                key={entry.id}
                className={`op-item ${selectedLog?.id === entry.id ? 'active' : ''}`}
                onClick={() => { setSelectedLog(entry); setHttpTab('parsed'); }}
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                <span className={`status-dot ${entry.status}`} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.operation}</span>
                <span className="log-time" style={{ fontSize: 10 }}>
                  {entry.elapsed > 0 ? `${entry.elapsed}ms` : '...'}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area">
        <div className="main-split">
          {/* Params Form */}
          <div className="params-panel">
            <div className="params-header">
              <div>
                <div className="params-title">{selectedOp.label}</div>
                <div className="params-desc">{selectedOp.description}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    // Reset params to defaults
                    const defaults: Record<string, string> = {};
                    selectedOp.fields.forEach(f => {
                      if (f.defaultValue) defaults[f.name] = f.defaultValue;
                    });
                    setParams(defaults);
                  }}
                >
                  Reset
                </button>
                <button
                  className="btn btn-primary"
                  onClick={executeRequest}
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="spinner" /> Sending...</>
                  ) : (
                    <>▶ Execute</>
                  )}
                </button>
              </div>
            </div>

            {selectedOp.fields.length > 0 ? (
              <div className="params-grid">
                {selectedOp.fields.map(field => (
                  <div key={field.name}>
                    <label>
                      {field.label}
                      {field.required && <span className="req">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={params[field.name] || ''}
                        onChange={e => setParam(field.name, e.target.value)}
                      >
                        {field.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={params[field.name] || ''}
                        onChange={e => setParam(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        spellCheck={false}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                No parameters required — just hit Execute.
              </div>
            )}

            {/* Endpoint info */}
            <div style={{ marginTop: 14, padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }}>POST </span>
              <span style={{ color: 'var(--blue)' }}>{getEndpoint(creds)}</span>
            </div>
          </div>

          {/* HTTP Viewer */}
          <div className="http-viewer">
            <div className="http-tabs">
              <div className={`http-tab ${httpTab === 'parsed' ? 'active' : ''}`} onClick={() => setHttpTab('parsed')}>
                Parsed
              </div>
              <div className={`http-tab ${httpTab === 'request' ? 'active' : ''}`} onClick={() => setHttpTab('request')}>
                Request XML
              </div>
              <div className={`http-tab ${httpTab === 'response' ? 'active' : ''}`} onClick={() => setHttpTab('response')}>
                Response XML
              </div>
              {viewEntry && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, paddingRight: 8 }}>
                  {viewEntry.httpStatus > 0 && (
                    <span style={{
                      fontSize: 11,
                      color: viewEntry.httpStatus === 200 ? 'var(--green)' : 'var(--red)',
                      fontWeight: 600
                    }}>
                      HTTP {viewEntry.httpStatus}
                    </span>
                  )}
                  {viewEntry.elapsed > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {viewEntry.elapsed}ms
                    </span>
                  )}
                  <button
                    className="btn btn-ghost btn-sm copy-btn"
                    onClick={() => {
                      const text = httpTab === 'request' ? viewEntry.requestXml : viewEntry.responseXml;
                      copyToClipboard(text, httpTab);
                    }}
                  >
                    Copy
                    <span className={`tooltip ${copyTooltip === httpTab ? 'show' : ''}`}>Copied!</span>
                  </button>
                </div>
              )}
            </div>
            <div className="http-content">
              {!viewEntry ? (
                <div className="empty-state">
                  <div className="icon">⚡</div>
                  <div>Execute an operation to see HTTP details</div>
                  <div style={{ fontSize: 11 }}>Request and response XML will appear here</div>
                </div>
              ) : httpTab === 'request' ? (
                <pre className="xml-display">{formatXml(viewEntry.requestXml)}</pre>
              ) : httpTab === 'response' ? (
                viewEntry.status === 'pending' ? (
                  <div className="empty-state">
                    <span className="spinner" style={{ width: 20, height: 20, borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                    <div>Waiting for response...</div>
                  </div>
                ) : (
                  <pre className="xml-display">{formatXml(viewEntry.responseXml)}</pre>
                )
              ) : (
                /* Parsed tab */
                viewEntry.status === 'pending' ? (
                  <div className="empty-state">
                    <span className="spinner" style={{ width: 20, height: 20, borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                    <div>Waiting for response...</div>
                  </div>
                ) : (
                  <div>
                    {/* Summary bar */}
                    <div style={{
                      display: 'flex', gap: 16, marginBottom: 14, padding: '10px 12px',
                      background: viewEntry.status === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                      borderRadius: 'var(--radius)', alignItems: 'center', flexWrap: 'wrap'
                    }}>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ACK </span>
                        <span className={viewEntry.ack === 'Success' || viewEntry.ack === 'SuccessWithWarning' ? 'ack-success' : 'ack-failure'}>
                          {viewEntry.ack || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>HTTP </span>
                        <span style={{ fontWeight: 600 }}>{viewEntry.httpStatus || 'ERR'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time </span>
                        <span>{viewEntry.elapsed}ms</span>
                      </div>
                      {viewEntry.correlationId && (
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CorrelationID </span>
                          <span style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(viewEntry.correlationId!, 'corr')}>
                            {viewEntry.correlationId}
                          </span>
                        </div>
                      )}
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operation </span>
                        <span style={{ color: 'var(--accent)' }}>{viewEntry.operation}</span>
                      </div>
                    </div>

                    {/* Parsed key-values */}
                    <table className="parsed-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(parsedResponse).map(([key, value]) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td>
                              <span
                                style={{ cursor: 'pointer' }}
                                onClick={() => copyToClipboard(value, key)}
                                title="Click to copy"
                              >
                                {key === 'Ack' ? (
                                  <span className={value === 'Success' || value === 'SuccessWithWarning' ? 'ack-success' : 'ack-failure'}>{value}</span>
                                ) : key === 'Token' || key === 'TransactionID' || key === 'PaymentTransactionID' ? (
                                  <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{value}</span>
                                ) : (
                                  value
                                )}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {Object.keys(parsedResponse).length === 0 && viewEntry.responseXml && (
                          <tr>
                            <td colSpan={2} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                              Could not parse response — check Response XML tab
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Token quick link for SetExpressCheckout */}
                    {viewEntry.operation === 'SetExpressCheckout' && parsedResponse['Token'] && viewEntry.status === 'success' && (
                      <div style={{
                        marginTop: 14, padding: '10px 12px',
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
                        fontSize: 12
                      }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', marginBottom: 6 }}>
                          Buyer Approval URL
                        </div>
                        <a
                          href={`https://www.${creds.environment === 'sandbox' ? 'sandbox.' : ''}paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=${parsedResponse['Token']}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--blue)', textDecoration: 'none', wordBreak: 'break-all' }}
                        >
                          https://www.{creds.environment === 'sandbox' ? 'sandbox.' : ''}paypal.com/cgi-bin/webscr?cmd=_express-checkout&token={parsedResponse['Token']}
                        </a>
                        <div style={{ marginTop: 8 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              // Auto-fill GetExpressCheckoutDetails with this token
                              const getEcOp = OPERATIONS.find(o => o.name === 'GetExpressCheckoutDetails');
                              if (getEcOp) {
                                setSelectedOp(getEcOp);
                                setParams({ Token: parsedResponse['Token'] });
                              }
                            }}
                          >
                            → GetExpressCheckoutDetails with this token
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quick actions for GetExpressCheckoutDetails */}
                    {viewEntry.operation === 'GetExpressCheckoutDetails' && parsedResponse['Token'] && parsedResponse['PayerID'] && viewEntry.status === 'success' && (
                      <div style={{
                        marginTop: 14, padding: '10px 12px',
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
                        fontSize: 12
                      }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', marginBottom: 6 }}>
                          Quick Action
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const doEcOp = OPERATIONS.find(o => o.name === 'DoExpressCheckoutPayment');
                            if (doEcOp) {
                              setSelectedOp(doEcOp);
                              setParams({
                                Token: parsedResponse['Token'],
                                PayerID: parsedResponse['PayerID'],
                                OrderTotal: parsedResponse['OrderTotal']?.replace(/\s.*/, '') || '10.00',
                                CurrencyCode: 'USD',
                                PaymentAction: 'Sale',
                              });
                            }
                          }}
                        >
                          → DoExpressCheckoutPayment with Token + PayerID
                        </button>
                      </div>
                    )}

                    {/* Quick action: GetTransactionDetails from a payment response */}
                    {(viewEntry.operation === 'DoExpressCheckoutPayment' || viewEntry.operation === 'DoDirectPayment') &&
                      (parsedResponse['TransactionID'] || parsedResponse['PaymentTransactionID']) &&
                      viewEntry.status === 'success' && (
                      <div style={{
                        marginTop: 14, padding: '10px 12px',
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
                        fontSize: 12
                      }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', marginBottom: 6 }}>
                          Quick Actions
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              const gtdOp = OPERATIONS.find(o => o.name === 'GetTransactionDetails');
                              if (gtdOp) {
                                setSelectedOp(gtdOp);
                                setParams({ TransactionID: parsedResponse['TransactionID'] || parsedResponse['PaymentTransactionID'] });
                              }
                            }}
                          >
                            → GetTransactionDetails
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              const refOp = OPERATIONS.find(o => o.name === 'RefundTransaction');
                              if (refOp) {
                                setSelectedOp(refOp);
                                setParams({
                                  TransactionID: parsedResponse['TransactionID'] || parsedResponse['PaymentTransactionID'],
                                  RefundType: 'Full',
                                  CurrencyCode: 'USD',
                                });
                              }
                            }}
                          >
                            → RefundTransaction
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <span className={`status-dot ${loading ? 'pending' : log.length > 0 ? log[0].status : ''}`} />
          <span>
            {loading ? 'Sending SOAP request...' :
             log.length > 0 ? `Last: ${log[0].operation} — ${log[0].ack || log[0].status} (${log[0].elapsed}ms)` :
             'Ready'}
          </span>
          <span style={{ marginLeft: 'auto' }}>
            Endpoint: {getEndpoint(creds)}
          </span>
        </div>
      </main>
    </div>
  );
}
