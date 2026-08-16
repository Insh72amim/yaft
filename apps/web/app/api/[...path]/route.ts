import { NextRequest, NextResponse } from 'next/server';

const apiOrigin = (process.env.YAFT_API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

async function handleProxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = Array.isArray(path) ? path.join('/') : path;
  const targetUrl = `${apiOrigin}/api/${pathStr}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  });

  const method = request.method;
  const hasBody = !['GET', 'HEAD'].includes(method);

  try {
    const res = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? request.body : undefined,
      // @ts-expect-error duplex is required for streaming request body in Node.js fetch
      duplex: 'half',
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || 'Internal proxy error' },
      { status: 500 },
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow long operations like large backup restores
