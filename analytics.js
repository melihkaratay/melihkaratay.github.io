(function () {
    'use strict';

    var loaderScript = document.currentScript;
    var dataAttributeId = loaderScript && loaderScript.dataset && loaderScript.dataset.gaId
        ? loaderScript.dataset.gaId.trim()
        : '';

    // Optional: host the real ID behind a private endpoint (e.g., Cloudflare Worker) so it is not stored in the repo.
    var REMOTE_CONFIG_URL = 'https://melih-ai-proxy.melihkaratay.workers.dev/ga-id';

    function appendGtagScript(id) {
        var gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
        gtagScript.addEventListener('error', function () {
            console.warn('GA4 script failed to load.');
        });
        document.head.appendChild(gtagScript);
    }

    function bootstrap(id) {
        if (!id || id === 'G-XXXXXXXXXX') {
            console.warn('GA4 measurement ID is missing. Set it via remote config or data-ga-id.');
            return;
        }

        appendGtagScript(id);

        window.dataLayer = window.dataLayer || [];
        function gtag() {
            dataLayer.push(arguments);
        }

        gtag('js', new Date());
        gtag('config', id, {
            anonymize_ip: true,
            transport_type: 'beacon'
        });
    }

    function fetchRemoteId() {
        return fetch(REMOTE_CONFIG_URL, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error('Config fetch failed: ' + res.status);
                }
                return res.json();
            })
            .then(function (payload) {
                return payload && payload.id ? String(payload.id).trim() : '';
            })
            .catch(function (err) {
                console.warn('GA4 config endpoint unreachable:', err);
                return '';
            });
    }

    fetchRemoteId()
        .then(function (remoteId) {
            var resolvedId = remoteId || dataAttributeId;
            bootstrap(resolvedId);
        });
})();
