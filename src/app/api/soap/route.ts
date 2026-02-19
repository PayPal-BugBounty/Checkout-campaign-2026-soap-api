import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, soapXml } = body;

    if (!endpoint || !soapXml) {
      return NextResponse.json({ error: 'Missing endpoint or soapXml' }, { status: 400 });
    }

    const startTime = Date.now();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: soapXml,
    });

    const elapsed = Date.now() - startTime;
    const responseText = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
      elapsed,
      requestHeaders: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Host': new URL(endpoint).host,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
