import { useEffect, useState } from 'react';
import DashboardEmbed from './DashboardEmbed';

let cachedEmbedUrl = null;
let embedUrlRequestPromise = null;
const quickSightApiBaseUrl = import.meta.env.VITE_QUICKSIGHT_API_BASE_URL || '/quicksight';

async function loadDashboardEmbedUrl() {
  if (cachedEmbedUrl) {
    return cachedEmbedUrl;
  }

  if (!embedUrlRequestPromise) {
    embedUrlRequestPromise = fetch(`${quickSightApiBaseUrl}/dashboard-url`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        cachedEmbedUrl = data.embedUrl;
        return data.embedUrl;
      })
      .finally(() => {
        embedUrlRequestPromise = null;
      });
  }

  return embedUrlRequestPromise;
}

function DashboardSection() {
  const [embedUrl, setEmbedUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchEmbedUrl() {
      try {
        setIsLoading(true);
        setError('');

        const nextEmbedUrl = await loadDashboardEmbedUrl();
        if (active) {
          setEmbedUrl(nextEmbedUrl);
        }
      } catch (fetchError) {
        console.error('Failed to fetch QuickSight embed URL:', fetchError);
        if (active) {
          setError('Unable to load the QuickSight dashboard embed URL.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    fetchEmbedUrl();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="dashboard-surface">
      <div className={`dashboard-placeholder ${embedUrl && !isLoading && !error ? 'dashboard-placeholder-embed' : ''}`}>
        {isLoading && (
          <div className="placeholder-content">
            <span className="placeholder-badge">Embedded Analytics</span>
            <h3>Loading QuickSight Dashboard</h3>
            <p>Requesting a fresh embed URL from the backend service.</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="placeholder-content">
            <span className="placeholder-badge">Embedding Error</span>
            <h3>QuickSight Dashboard Unavailable</h3>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && embedUrl && (
          <DashboardEmbed
            embedUrl={embedUrl}
            onEmbedError={(message) => {
              setError(message);
            }}
          />
        )}
      </div>
    </section>
  );
}

export default DashboardSection;
