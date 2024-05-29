const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Whitelist Manager</title>
</head>
<body>
    <h1>Manage Whitelist</h1>
    <textarea id="whitelist" rows="10" cols="50"></textarea><br>
    <button onclick="updateWhitelist()">Update Whitelist</button>
    <h2>Available Fonts</h2>
    <ul id="font-list"></ul>
    <script>
        async function loadWhitelist() {
            const response = await fetch('/whitelist');
            const whitelist = await response.json();
            document.getElementById('whitelist').value = whitelist.join('\\n');
        }

        async function updateWhitelist() {
            const whitelist = document.getElementById('whitelist').value.split('\\n');
            await fetch('/whitelist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ domains: whitelist })
            });
            alert('Whitelist updated');
        }

        async function loadFonts() {
            const response = await fetch('/listFonts');
            const fonts = await response.json();
            const fontList = document.getElementById('font-list');
            fontList.innerHTML = '';
            for (const [name, size] of Object.entries(fonts)) {
                const listItem = document.createElement('li');
                listItem.textContent = \`\${name}: \${size} bytes\`;
                fontList.appendChild(listItem);
            }
        }

        loadWhitelist();
        loadFonts();
    </script>
</body>
</html>
`;

addEventListener('fetch', (event: FetchEvent) => {
	event.respondWith(handleRequest(event));
});

async function handleRequest(event: FetchEvent): Promise<Response> {
	const request = event.request;
	const url = new URL(request.url);
	const path = url.pathname.split('/');

	if (path[1] === 'whitelist') {
		switch (request.method) {
			case 'GET':
				if (path[2] === 'html') {
					return serveHTMLInterface();
				}
				return getWhitelist();
			case 'POST':
				return updateWhitelist(request);
			default:
				return new Response('Method Not Allowed', { status: 405 });
		}
	} else if (path[1] === 'listFonts') {
		return listFonts();
	} else {
		return serveFont(request);
	}
}

async function getWhitelist(): Promise<Response> {
	const whitelist = (await SCOTTS_FONTS.get('domains')) || '[]';
	return new Response(whitelist, {
		headers: { 'Content-Type': 'application/json' },
	});
}

async function updateWhitelist(request: Request): Promise<Response> {
	const { domains } = (await request.json()) as { domains: string[] };
	if (!domains) {
		return new Response('Bad Request', { status: 400 });
	}

	await SCOTTS_FONTS.put('domains', JSON.stringify(domains));
	return new Response('Whitelist updated', { status: 200 });
}

async function serveFont(request: Request): Promise<Response> {
	const origin = request.headers.get('Origin');

	const allowed = await isAllowedDomain(origin!);

	if (!allowed) {
		return new Response('Forbidden', { status: 403 });
	}

	const url = new URL(request.url);
	const fontKey = url.pathname.slice(1);
	const font = await SCOTTS_FONTS.get(fontKey, 'arrayBuffer');

	if (!font) {
		return new Response('Font not found', { status: 404 });
	}

	return new Response(font, {
		headers: {
			'Content-Type': 'font/woff2',
			'Cache-Control': 'public, max-age=31536000',
			'Access-Control-Allow-Origin': origin!,
			'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

async function listFonts(): Promise<Response> {
	const { keys } = await SCOTTS_FONTS.list();
	const fontKeys = keys.filter((key) => key.name !== 'domains' && key.name !== 'whitelist');
	const fonts = {};

	for (const key of fontKeys) {
		const font = await SCOTTS_FONTS.get(key.name, 'arrayBuffer');
		fonts[key.name] = font ? font.byteLength : 0; // or any other relevant info
	}

	return new Response(JSON.stringify(fonts), {
		headers: { 'Content-Type': 'application/json' },
	});
}

async function serveHTMLInterface(): Promise<Response> {
	return new Response(htmlContent, {
		headers: { 'Content-Type': 'text/html' },
	});
}

async function isAllowedDomain(url: string) {
	try {
		const allowedDomains = ((await SCOTTS_FONTS.get('domains')) || '').split(',');
		const { hostname } = new URL(url);
		return allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
	} catch (error) {
		console.error('Invalid URL:', error);
		return false;
	}
}
