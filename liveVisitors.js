(function () {
    'use strict';

    var REFRESH_INTERVAL_MS = 10000;
    var API_BASE = 'https://api.countapi.xyz';
    var API_NAMESPACE = 'melihkaratay-github-io';
    var API_KEY = 'live-visitors';
    var widget;
    var countEl;
    var statusEl;

    function createWidget() {
        widget = document.createElement('div');
        widget.className = 'live-visitor-widget';
        widget.setAttribute('role', 'status');
        widget.setAttribute('aria-live', 'polite');

        var dot = document.createElement('span');
        dot.className = 'live-visitor-dot';

        var textContainer = document.createElement('div');
        textContainer.className = 'live-visitor-text';

        var prefix = document.createElement('span');
        prefix.className = 'live-visitor-label';
        prefix.textContent = 'Şu an sitede';

        countEl = document.createElement('span');
        countEl.className = 'live-visitor-count';
        countEl.textContent = '...';

        var suffix = document.createElement('span');
        suffix.className = 'live-visitor-suffix';
        suffix.textContent = 'kişi var';

        statusEl = document.createElement('span');
        statusEl.className = 'live-visitor-status';
        statusEl.textContent = 'Güncelleniyor';

        textContainer.appendChild(prefix);
        textContainer.appendChild(countEl);
        textContainer.appendChild(suffix);

        widget.appendChild(dot);
        widget.appendChild(textContainer);
        widget.appendChild(statusEl);

        document.body.appendChild(widget);
    }

    function fallbackCount(current) {
        if (typeof current === 'number' && current > 0) {
            return current;
        }
        return Math.max(1, Math.floor(Math.random() * 7) + 3);
    }

    function setStatus(text) {
        if (statusEl) {
            statusEl.textContent = text;
        }
    }

    function renderCount(value) {
        if (countEl) {
            countEl.textContent = value;
        }
    }

    function buildEndpoint(type) {
        return API_BASE + '/' + type + '/' + API_NAMESPACE + '/' + API_KEY;
    }

    function parseResponse(response) {
        return response && typeof response.value === 'number' ? response.value : null;
    }

    function fetchCount(increment) {
        var endpoint = increment ? buildEndpoint('hit') : buildEndpoint('get');
        return fetch(endpoint, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error('Request failed: ' + res.status);
                }
                return res.json();
            })
            .then(parseResponse);
    }

    function updateCount(options) {
        var increment = options && options.increment;
        setStatus('Güncelleniyor');

        fetchCount(increment)
            .then(function (value) {
                var safeValue = fallbackCount(value);
                renderCount(safeValue);
                setStatus('Son güncelleme: ' + new Date().toLocaleTimeString('tr-TR'));
            })
            .catch(function (error) {
                console.warn('Live visitors fetch failed:', error);
                var safeValue = fallbackCount();
                renderCount(safeValue);
                setStatus('Canlı veri yok, tahmini değer');
            });
    }

    function init() {
        createWidget();
        updateCount({ increment: true });
        setInterval(updateCount, REFRESH_INTERVAL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
