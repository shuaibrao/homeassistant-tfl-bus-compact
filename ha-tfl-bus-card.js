// TfL Live Bus Arrivals Card for Home Assistant
// Compact real-time countdown card for bus stops.

class TfLBusCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._stopsData = new Map();
    this._loading = true;
    this._error = null;
    this._pollTimer = null;
    this._tickTimer = null;
  }

  // --- Home Assistant Card Lifecycle ---

  setConfig(config) {
    if (!config.stops?.length) {
      throw new Error('You must define at least one stop ID in "stops".');
    }

    this.config = {
      title: null,
      line: null,
      max_arrivals: 2,
      update_interval: 30,
      api_key: null,
      ...config,
      stops: config.stops.map(s => typeof s === 'string' ? { id: s } : s)
    };

    this._restartPolling();
    this._fetchAll();
  }

  set hass(hass) {
    this._hass = hass;
  }

  connectedCallback() {
    if (this.config) this._restartPolling();
    this._startTick();
    this._render();
  }

  disconnectedCallback() {
    this._clearTimers();
  }

  getCardSize() {
    return 2;
  }

  // --- Timer Management ---

  _restartPolling() {
    clearInterval(this._pollTimer);
    this._pollTimer = setInterval(
      () => this._fetchAll(),
      this.config.update_interval * 1000
    );
  }

  _startTick() {
    clearInterval(this._tickTimer);
    // Re-render every 15s to keep countdowns accurate between API polls
    this._tickTimer = setInterval(() => this._render(), 15000);
  }

  _clearTimers() {
    clearInterval(this._pollTimer);
    clearInterval(this._tickTimer);
    this._pollTimer = null;
    this._tickTimer = null;
  }

  // --- Data Fetching ---

  async _fetchAll() {
    const isFirstLoad = this._stopsData.size === 0;
    if (isFirstLoad) {
      this._loading = true;
      this._render();
    }

    try {
      const results = await Promise.all(
        this.config.stops.map(stop => this._fetchStop(stop))
      );
      this._stopsData = new Map(results);
      this._error = null;
    } catch (err) {
      console.error('TfL Bus Card:', err);
      if (isFirstLoad) this._error = err.message;
    } finally {
      this._loading = false;
      this._render();
    }
  }

  async _fetchStop(stop) {
    let url = `https://api.tfl.gov.uk/StopPoint/${stop.id}/Arrivals`;
    if (this.config.api_key) {
      url += `?app_key=${this.config.api_key}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TfL API error (${response.status})`);
    }

    let arrivals = await response.json();

    // Filter to configured line only
    if (this.config.line) {
      arrivals = arrivals.filter(a => a.lineId === this.config.line);
    }

    // Sort by soonest arrival and cap to max
    arrivals.sort((a, b) => a.timeToStation - b.timeToStation);
    arrivals = arrivals.slice(0, this.config.max_arrivals);

    return [stop.id, {
      label: stop.label || arrivals[0]?.destinationName || 'Unknown',
      stationName: arrivals[0]?.stationName || '',
      arrivals: arrivals.map(a => ({
        expectedArrival: new Date(a.expectedArrival).getTime()
      }))
    }];
  }

  // --- Rendering ---

  _formatCountdown(arrival) {
    const secondsLeft = Math.max(0, (arrival.expectedArrival - Date.now()) / 1000);
    if (secondsLeft < 60) return { text: 'due', isDue: true };
    return { text: `${Math.floor(secondsLeft / 60)} min`, isDue: false };
  }

  _render() {
    if (!this.shadowRoot) return;

    const line = this.config?.line || '';
    const firstStop = [...this._stopsData.values()][0];
    const title = this.config?.title ?? firstStop?.stationName ?? '';

    let bodyHtml;

    if (this._loading) {
      bodyHtml = `
        <div class="bus-msg">
          <div class="bus-spinner"></div>Loading...
        </div>`;
    } else if (this._error) {
      bodyHtml = `<div class="bus-msg bus-error">${this._error}</div>`;
    } else {
      bodyHtml = (this.config?.stops || []).map(stop => {
        const data = this._stopsData.get(stop.id);
        if (!data) return '';

        // Filter out buses that have already departed
        const active = data.arrivals.filter(
          a => a.expectedArrival > Date.now() - 30000
        );

        let timesHtml;
        if (active.length === 0) {
          timesHtml = '<span class="bus-no-data">—</span>';
        } else {
          timesHtml = active.map(a => {
            const { text, isDue } = this._formatCountdown(a);
            return `<span class="bus-time${isDue ? ' bus-due' : ''}">${text}</span>`;
          }).join('');
        }

        return `
          <div class="bus-stop-row">
            <div class="bus-destination">
              <span class="bus-arrow">→</span>${data.label}
            </div>
            <div class="bus-times">${timesHtml}</div>
          </div>`;
      }).join('');
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .bus-card {
          font-family: var(--paper-font-body1_-_font-family, system-ui, -apple-system, sans-serif);
          background: #ffffff;
          color: var(--primary-text-color, #333333);
          border-radius: var(--ha-card-border-radius, 12px);
          border: var(--ha-card-border, 1px solid var(--divider-color, #e0e0e0));
          box-shadow: var(--ha-card-box-shadow, none);
          overflow: hidden;
        }
        @media (prefers-color-scheme: dark) {
          .bus-card {
            background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
            color: var(--primary-text-color, #ffffff);
            --primary-text-color: var(--primary-text-color);
            --secondary-text-color: var(--secondary-text-color);
            --secondary-background-color: var(--secondary-background-color);
            --divider-color: var(--divider-color);
          }
        }

        /* Header */
        .bus-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #DC241F;
          color: #fff;
        }
        .bus-route-badge {
          background: #fff;
          color: #DC241F;
          font-weight: 800;
          font-size: 14px;
          padding: 1px 7px;
          border-radius: 4px;
          line-height: 1.4;
          flex-shrink: 0;
        }
        .bus-header-title {
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }

        /* Stop rows */
        .bus-stop-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 12px;
          border-bottom: 1px solid var(--divider-color, #f0f0f0);
          gap: 6px;
        }
        .bus-stop-row:last-child {
          border-bottom: none;
        }
        .bus-destination {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--primary-text-color, #333);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .bus-arrow {
          color: #DC241F;
          font-weight: 700;
          margin-right: 3px;
        }

        /* Time badges */
        .bus-times {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }
        .bus-time {
          background: var(--secondary-background-color, #f0f0f0);
          color: var(--primary-text-color, #333);
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 8px;
          white-space: nowrap;
        }
        .bus-due {
          background: #DC241F;
          color: #fff;
        }
        .bus-no-data {
          font-size: 11px;
          color: var(--secondary-text-color, #999);
        }

        /* State messages */
        .bus-msg {
          padding: 14px 12px;
          font-size: 12px;
          color: var(--secondary-text-color, #888);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .bus-error {
          color: #c0392b;
        }
        .bus-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(220, 36, 31, 0.15);
          border-top-color: #DC241F;
          border-radius: 50%;
          animation: bus-spin 0.7s linear infinite;
        }
        @keyframes bus-spin {
          to { transform: rotate(360deg); }
        }
      </style>
      <div class="bus-card">
        <div class="bus-header">
          <span class="bus-route-badge">${line || '🚌'}</span>
          <span class="bus-header-title">${title}</span>
        </div>
        ${bodyHtml}
      </div>`;
  }
}

customElements.define('ha-tfl-bus-card', TfLBusCard);

// Register with the HA card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-tfl-bus-card',
  name: 'TfL Bus Arrivals Card',
  description: 'Compact live bus arrival countdown card for TfL stops.',
  preview: true
});
